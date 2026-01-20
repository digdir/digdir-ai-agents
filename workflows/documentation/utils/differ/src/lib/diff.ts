/**
 * Diff operations using diff-match-patch
 */

import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export enum DiffOperation {
  DELETE = -1,
  EQUAL = 0,
  INSERT = 1
}

export interface DiffSegment {
  operation: DiffOperation;
  text: string;
}

export interface LineDiff {
  lineNumber: number;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  oldText?: string;
  newText?: string;
  segments?: DiffSegment[];
}

export interface AlignedLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified' | 'padding';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldText: string | null;
  newText: string | null;
  segments?: DiffSegment[];
}

/**
 * Compute character-level diff between two texts
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([operation, text]) => ({
    operation: operation as DiffOperation,
    text
  }));
}

/**
 * Normalize line endings to LF for consistent diff comparison
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Compute line-by-line diff with inline character changes
 */
export function computeLineDiff(oldText: string, newText: string): LineDiff[] {
  // Normalize line endings before comparison
  const normalizedOld = normalizeLineEndings(oldText);
  const normalizedNew = normalizeLineEndings(newText);

  // Use diff-match-patch line mode
  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(normalizedOld, normalizedNew);
  const diffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_charsToLines_(diffs, lineArray);
  dmp.diff_cleanupSemantic(diffs);

  const result: LineDiff[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const [operation, text] of diffs) {
    // Split text into lines, keeping track of whether it ends with newline
    const lines = text.split('\n');
    // Remove last empty element if text ends with \n
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    for (const line of lines) {
      if (operation === DiffOperation.EQUAL) {
        result.push({
          lineNumber: result.length + 1,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          type: 'unchanged',
          oldText: line,
          newText: line
        });
      } else if (operation === DiffOperation.DELETE) {
        result.push({
          lineNumber: result.length + 1,
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
          type: 'removed',
          oldText: line
        });
      } else if (operation === DiffOperation.INSERT) {
        result.push({
          lineNumber: result.length + 1,
          oldLineNumber: null,
          newLineNumber: newLineNum++,
          type: 'added',
          newText: line
        });
      }
    }
  }

  // Post-process to identify modified lines
  // Handle both single removed+added pairs AND blocks of removed followed by added
  const processed: LineDiff[] = [];
  let i = 0;

  while (i < result.length) {
    const current = result[i];

    // Check if we're starting a block of removed lines
    if (current.type === 'removed') {
      // Collect all consecutive removed lines
      const removedBlock: LineDiff[] = [];
      while (i < result.length && result[i].type === 'removed') {
        removedBlock.push(result[i]);
        i++;
      }

      // Collect all consecutive added lines that follow
      const addedBlock: LineDiff[] = [];
      while (i < result.length && result[i].type === 'added') {
        addedBlock.push(result[i]);
        i++;
      }

      // If we have both removed and added blocks, try to match lines
      if (removedBlock.length > 0 && addedBlock.length > 0) {
        const matchedLines = matchLinesInBlocks(removedBlock, addedBlock);
        for (const line of matchedLines) {
          processed.push({
            ...line,
            lineNumber: processed.length + 1
          });
        }
      } else {
        // Only removed lines (no added), add them as-is
        for (const line of removedBlock) {
          processed.push({
            ...line,
            lineNumber: processed.length + 1
          });
        }
        // Add any collected added lines (shouldn't happen, but just in case)
        for (const line of addedBlock) {
          processed.push({
            ...line,
            lineNumber: processed.length + 1
          });
        }
      }
    } else {
      processed.push({
        ...current,
        lineNumber: processed.length + 1
      });
      i++;
    }
  }

  return processed;
}

/**
 * Match lines between removed and added blocks based on similarity
 * Returns a merged list with modified, removed, and added lines
 */
function matchLinesInBlocks(
  removedBlock: LineDiff[],
  addedBlock: LineDiff[]
): LineDiff[] {
  const result: LineDiff[] = [];
  const usedAdded = new Set<number>();

  // For each removed line, find the best matching added line
  const matches: Array<{ removedIdx: number; addedIdx: number; similarity: number }> = [];

  for (let ri = 0; ri < removedBlock.length; ri++) {
    const removed = removedBlock[ri];
    const oldText = removed.oldText || '';

    let bestMatch = -1;
    let bestSimilarity = 0;

    for (let ai = 0; ai < addedBlock.length; ai++) {
      const added = addedBlock[ai];
      const newText = added.newText || '';
      const similarity = calculateSimilarity(oldText, newText);

      if (similarity > bestSimilarity && similarity >= 30) {
        bestSimilarity = similarity;
        bestMatch = ai;
      }
    }

    if (bestMatch >= 0) {
      matches.push({ removedIdx: ri, addedIdx: bestMatch, similarity: bestSimilarity });
    }
  }

  // Sort matches by similarity (highest first) and process greedily
  matches.sort((a, b) => b.similarity - a.similarity);

  const matchedRemoved = new Set<number>();
  const matchedAdded = new Set<number>();
  const finalMatches: Array<{ removedIdx: number; addedIdx: number }> = [];

  for (const match of matches) {
    if (!matchedRemoved.has(match.removedIdx) && !matchedAdded.has(match.addedIdx)) {
      finalMatches.push({ removedIdx: match.removedIdx, addedIdx: match.addedIdx });
      matchedRemoved.add(match.removedIdx);
      matchedAdded.add(match.addedIdx);
    }
  }

  // Build result: process in order of appearance
  // First, interleave matched pairs in their original order
  let ri = 0;
  let ai = 0;

  while (ri < removedBlock.length || ai < addedBlock.length) {
    // Check if current removed line is matched
    const removedMatch = finalMatches.find(m => m.removedIdx === ri);

    if (ri < removedBlock.length && removedMatch) {
      // This removed line is matched
      const removed = removedBlock[ri];
      const added = addedBlock[removedMatch.addedIdx];
      const oldText = removed.oldText || '';
      const newText = added.newText || '';

      // Check if lines are actually identical (100% similarity)
      if (oldText === newText) {
        result.push({
          lineNumber: 0, // Will be renumbered
          oldLineNumber: removed.oldLineNumber,
          newLineNumber: added.newLineNumber,
          type: 'unchanged',
          oldText,
          newText
        });
      } else {
        result.push({
          lineNumber: 0, // Will be renumbered
          oldLineNumber: removed.oldLineNumber,
          newLineNumber: added.newLineNumber,
          type: 'modified',
          oldText,
          newText,
          segments: computeDiff(oldText, newText)
        });
      }

      // Skip the matched added line when we encounter it
      usedAdded.add(removedMatch.addedIdx);
      ri++;
    } else if (ri < removedBlock.length && !matchedRemoved.has(ri)) {
      // Unmatched removed line
      result.push(removedBlock[ri]);
      ri++;
    } else if (ri < removedBlock.length) {
      // Matched but already processed
      ri++;
    } else if (ai < addedBlock.length && !usedAdded.has(ai)) {
      // Unmatched added line
      result.push(addedBlock[ai]);
      ai++;
    } else {
      ai++;
    }
  }

  return result;
}

interface HeadingInfo {
  lineIndex: number;
  text: string;
  level: number;
}

/**
 * Extract headings from text with their line positions
 */
function extractHeadings(lines: string[]): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        lineIndex: i,
        text: match[2].trim(),
        level: match[1].length
      });
    }
  }
  return headings;
}

/**
 * Match headings between old and new documents
 * Returns pairs of matched heading indices
 * Uses multiple strategies: exact match, similar text, and positional matching
 */
function matchHeadings(oldHeadings: HeadingInfo[], newHeadings: HeadingInfo[]): Map<number, number> {
  const matches = new Map<number, number>();
  const usedNew = new Set<number>();

  // First pass: exact text matches (same level and text)
  for (let oi = 0; oi < oldHeadings.length; oi++) {
    const oldH = oldHeadings[oi];

    for (let ni = 0; ni < newHeadings.length; ni++) {
      if (usedNew.has(ni)) continue;
      const newH = newHeadings[ni];

      if (oldH.level === newH.level && oldH.text === newH.text) {
        matches.set(oi, ni);
        usedNew.add(ni);
        break;
      }
    }
  }

  // Second pass: high similarity matches (>=60%)
  for (let oi = 0; oi < oldHeadings.length; oi++) {
    if (matches.has(oi)) continue;
    const oldH = oldHeadings[oi];
    let bestMatch = -1;
    let bestScore = 0;

    for (let ni = 0; ni < newHeadings.length; ni++) {
      if (usedNew.has(ni)) continue;
      const newH = newHeadings[ni];

      // Must be same level
      if (oldH.level !== newH.level) continue;

      const similarity = calculateSimilarity(oldH.text, newH.text);
      if (similarity > bestScore && similarity >= 60) {
        bestScore = similarity;
        bestMatch = ni;
      }
    }

    if (bestMatch >= 0) {
      matches.set(oi, bestMatch);
      usedNew.add(bestMatch);
    }
  }

  // Third pass: lower threshold (>=30%) for remaining unmatched headings
  // This helps when headings are translated or slightly modified
  for (let oi = 0; oi < oldHeadings.length; oi++) {
    if (matches.has(oi)) continue;
    const oldH = oldHeadings[oi];
    let bestMatch = -1;
    let bestScore = 0;

    for (let ni = 0; ni < newHeadings.length; ni++) {
      if (usedNew.has(ni)) continue;
      const newH = newHeadings[ni];

      // Must be same level
      if (oldH.level !== newH.level) continue;

      const similarity = calculateSimilarity(oldH.text, newH.text);
      if (similarity > bestScore && similarity >= 30) {
        bestScore = similarity;
        bestMatch = ni;
      }
    }

    if (bestMatch >= 0) {
      matches.set(oi, bestMatch);
      usedNew.add(bestMatch);
    }
  }

  // Fourth pass: positional matching for remaining same-level headings
  // Match by relative position if there are unmatched headings at same level
  const unmatchedOld = oldHeadings
    .map((h, i) => ({ ...h, idx: i }))
    .filter(h => !matches.has(h.idx));
  const unmatchedNew = newHeadings
    .map((h, i) => ({ ...h, idx: i }))
    .filter(h => !usedNew.has(h.idx));

  // Group by level
  const oldByLevel = new Map<number, typeof unmatchedOld>();
  const newByLevel = new Map<number, typeof unmatchedNew>();

  for (const h of unmatchedOld) {
    const list = oldByLevel.get(h.level) || [];
    list.push(h);
    oldByLevel.set(h.level, list);
  }

  for (const h of unmatchedNew) {
    const list = newByLevel.get(h.level) || [];
    list.push(h);
    newByLevel.set(h.level, list);
  }

  // Match by position within same level
  for (const [level, oldList] of oldByLevel) {
    const newList = newByLevel.get(level) || [];
    const count = Math.min(oldList.length, newList.length);

    for (let i = 0; i < count; i++) {
      matches.set(oldList[i].idx, newList[i].idx);
      usedNew.add(newList[i].idx);
    }
  }

  return matches;
}

/**
 * Create aligned lines for side-by-side display with heading-based alignment
 * First aligns headings, then fills in content between them
 */
export function createAlignedLines(oldText: string, newText: string): AlignedLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const oldHeadings = extractHeadings(oldLines);
  const newHeadings = extractHeadings(newLines);
  const headingMatches = matchHeadings(oldHeadings, newHeadings);

  // Build aligned output by processing sections between headings
  const aligned: AlignedLine[] = [];

  // Create section boundaries (heading positions + end)
  const oldSections = [...oldHeadings.map(h => h.lineIndex), oldLines.length];
  const newSections = [...newHeadings.map(h => h.lineIndex), newLines.length];

  let oldPos = 0;
  let newPos = 0;
  let oldHeadingIdx = 0;
  let newHeadingIdx = 0;

  while (oldPos < oldLines.length || newPos < newLines.length) {
    // Find next matched heading pair
    let nextOldHeading = -1;
    let nextNewHeading = -1;

    for (let oi = oldHeadingIdx; oi < oldHeadings.length; oi++) {
      if (headingMatches.has(oi)) {
        nextOldHeading = oi;
        nextNewHeading = headingMatches.get(oi)!;
        break;
      }
    }

    if (nextOldHeading >= 0) {
      // Process content before the matched heading
      const oldHeadingLine = oldHeadings[nextOldHeading].lineIndex;
      const newHeadingLine = newHeadings[nextNewHeading].lineIndex;

      // Get content before heading
      const oldContentBefore = oldLines.slice(oldPos, oldHeadingLine);
      const newContentBefore = newLines.slice(newPos, newHeadingLine);

      // Diff and align content before heading
      if (oldContentBefore.length > 0 || newContentBefore.length > 0) {
        const contentDiff = computeLineDiff(
          oldContentBefore.join('\n'),
          newContentBefore.join('\n')
        );
        addDiffToAligned(aligned, contentDiff, oldPos, newPos);
      }

      // Calculate how many padding lines needed to align heading
      const oldAlignedCount = countAlignedLinesFor('old', aligned, oldPos, oldHeadingLine);
      const newAlignedCount = countAlignedLinesFor('new', aligned, newPos, newHeadingLine);
      const paddingNeeded = Math.abs(oldAlignedCount - newAlignedCount);

      // Add padding to shorter side
      for (let p = 0; p < paddingNeeded; p++) {
        if (oldAlignedCount < newAlignedCount) {
          aligned.push({
            type: 'padding',
            oldLineNumber: null,
            newLineNumber: null,
            oldText: null,
            newText: null
          });
        }
      }

      // Add the matched heading line
      const oldHeadingText = oldLines[oldHeadingLine];
      const newHeadingText = newLines[newHeadingLine];
      const headingSimilarity = calculateSimilarity(oldHeadingText, newHeadingText);

      if (headingSimilarity === 100) {
        aligned.push({
          type: 'unchanged',
          oldLineNumber: oldHeadingLine + 1,
          newLineNumber: newHeadingLine + 1,
          oldText: oldHeadingText,
          newText: newHeadingText
        });
      } else {
        aligned.push({
          type: 'modified',
          oldLineNumber: oldHeadingLine + 1,
          newLineNumber: newHeadingLine + 1,
          oldText: oldHeadingText,
          newText: newHeadingText,
          segments: computeDiff(oldHeadingText, newHeadingText)
        });
      }

      oldPos = oldHeadingLine + 1;
      newPos = newHeadingLine + 1;
      oldHeadingIdx = nextOldHeading + 1;
      newHeadingIdx = nextNewHeading + 1;
    } else {
      // No more matched headings, process remaining content
      const oldRemaining = oldLines.slice(oldPos);
      const newRemaining = newLines.slice(newPos);

      if (oldRemaining.length > 0 || newRemaining.length > 0) {
        const remainingDiff = computeLineDiff(
          oldRemaining.join('\n'),
          newRemaining.join('\n')
        );
        addDiffToAligned(aligned, remainingDiff, oldPos, newPos);
      }
      break;
    }
  }

  return aligned;
}

/**
 * Add diff results to aligned array
 */
function addDiffToAligned(
  aligned: AlignedLine[],
  diffs: LineDiff[],
  oldStartLine: number,
  newStartLine: number
): void {
  for (const diff of diffs) {
    if (diff.type === 'unchanged') {
      aligned.push({
        type: 'unchanged',
        oldLineNumber: diff.oldLineNumber !== null ? diff.oldLineNumber + oldStartLine : null,
        newLineNumber: diff.newLineNumber !== null ? diff.newLineNumber + newStartLine : null,
        oldText: diff.oldText || null,
        newText: diff.newText || null
      });
    } else if (diff.type === 'modified') {
      aligned.push({
        type: 'modified',
        oldLineNumber: diff.oldLineNumber !== null ? diff.oldLineNumber + oldStartLine : null,
        newLineNumber: diff.newLineNumber !== null ? diff.newLineNumber + newStartLine : null,
        oldText: diff.oldText || null,
        newText: diff.newText || null,
        segments: diff.segments
      });
    } else if (diff.type === 'removed') {
      aligned.push({
        type: 'removed',
        oldLineNumber: diff.oldLineNumber !== null ? diff.oldLineNumber + oldStartLine : null,
        newLineNumber: null,
        oldText: diff.oldText || null,
        newText: null
      });
    } else if (diff.type === 'added') {
      aligned.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: diff.newLineNumber !== null ? diff.newLineNumber + newStartLine : null,
        oldText: null,
        newText: diff.newText || null
      });
    }
  }
}

/**
 * Count lines in aligned array for a side (old or new)
 */
function countAlignedLinesFor(
  side: 'old' | 'new',
  aligned: AlignedLine[],
  startLine: number,
  endLine: number
): number {
  let count = 0;
  for (const line of aligned) {
    const lineNum = side === 'old' ? line.oldLineNumber : line.newLineNumber;
    if (lineNum !== null && lineNum >= startLine + 1 && lineNum <= endLine) {
      count++;
    }
  }
  return count;
}

/**
 * Create simple aligned lines without heading-based alignment (fallback)
 */
export function createSimpleAlignedLines(oldText: string, newText: string): AlignedLine[] {
  const lineDiffs = computeLineDiff(oldText, newText);
  const aligned: AlignedLine[] = [];

  for (const diff of lineDiffs) {
    if (diff.type === 'unchanged') {
      aligned.push({
        type: 'unchanged',
        oldLineNumber: diff.oldLineNumber,
        newLineNumber: diff.newLineNumber,
        oldText: diff.oldText || null,
        newText: diff.newText || null
      });
    } else if (diff.type === 'modified') {
      aligned.push({
        type: 'modified',
        oldLineNumber: diff.oldLineNumber,
        newLineNumber: diff.newLineNumber,
        oldText: diff.oldText || null,
        newText: diff.newText || null,
        segments: diff.segments
      });
    } else if (diff.type === 'removed') {
      aligned.push({
        type: 'removed',
        oldLineNumber: diff.oldLineNumber,
        newLineNumber: null,
        oldText: diff.oldText || null,
        newText: null
      });
    } else if (diff.type === 'added') {
      aligned.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: diff.newLineNumber,
        oldText: null,
        newText: diff.newText || null
      });
    }
  }

  return aligned;
}

/**
 * Generate HTML representation of diff with highlighting
 */
export function diffToHtml(segments: DiffSegment[]): string {
  return segments.map(({ operation, text }) => {
    const escaped = escapeHtml(text);
    switch (operation) {
      case DiffOperation.DELETE:
        return `<del class="diff-removed">${escaped}</del>`;
      case DiffOperation.INSERT:
        return `<ins class="diff-added">${escaped}</ins>`;
      default:
        return escaped;
    }
  }).join('');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Calculate similarity percentage between two texts
 */
export function calculateSimilarity(oldText: string, newText: string): number {
  // Normalize line endings for consistent comparison
  const normalizedOld = normalizeLineEndings(oldText);
  const normalizedNew = normalizeLineEndings(newText);
  const diffs = dmp.diff_main(normalizedOld, normalizedNew);
  const levenshtein = dmp.diff_levenshtein(diffs);
  const maxLength = Math.max(oldText.length, newText.length);

  if (maxLength === 0) return 100;
  return Math.round((1 - levenshtein / maxLength) * 100);
}
