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
 * Compute line-by-line diff with inline character changes
 */
export function computeLineDiff(oldText: string, newText: string): LineDiff[] {
  // Use diff-match-patch line mode
  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(oldText, newText);
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

  // Post-process to identify modified lines (removed + added pairs)
  const processed: LineDiff[] = [];
  let i = 0;

  while (i < result.length) {
    const current = result[i];
    const next = result[i + 1];

    // If we have a removed followed by added, treat as modified
    if (current.type === 'removed' && next?.type === 'added') {
      const charDiff = computeDiff(current.oldText || '', next.newText || '');
      processed.push({
        lineNumber: processed.length + 1,
        oldLineNumber: current.oldLineNumber,
        newLineNumber: next.newLineNumber,
        type: 'modified',
        oldText: current.oldText,
        newText: next.newText,
        segments: charDiff
      });
      i += 2;
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
 * Create aligned lines for side-by-side display
 * Inserts padding lines so that matching content aligns horizontally
 */
export function createAlignedLines(oldText: string, newText: string): AlignedLine[] {
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
  const diffs = dmp.diff_main(oldText, newText);
  const levenshtein = dmp.diff_levenshtein(diffs);
  const maxLength = Math.max(oldText.length, newText.length);

  if (maxLength === 0) return 100;
  return Math.round((1 - levenshtein / maxLength) * 100);
}
