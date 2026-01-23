/**
 * Unit tests for diff functions
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeLineEndings,
  computeLineDiff,
  calculateSimilarity,
  createSimpleAlignedLines,
  computeDiff,
  DiffOperation
} from './diff.js';

describe('normalizeLineEndings', () => {
  it('should convert CRLF to LF', () => {
    const input = 'line1\r\nline2\r\nline3';
    const expected = 'line1\nline2\nline3';
    expect(normalizeLineEndings(input)).toBe(expected);
  });

  it('should convert standalone CR to LF', () => {
    const input = 'line1\rline2\rline3';
    const expected = 'line1\nline2\nline3';
    expect(normalizeLineEndings(input)).toBe(expected);
  });

  it('should leave LF unchanged', () => {
    const input = 'line1\nline2\nline3';
    expect(normalizeLineEndings(input)).toBe(input);
  });

  it('should handle mixed line endings', () => {
    const input = 'line1\r\nline2\rline3\nline4';
    const expected = 'line1\nline2\nline3\nline4';
    expect(normalizeLineEndings(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    expect(normalizeLineEndings('')).toBe('');
  });

  it('should handle string with no line endings', () => {
    const input = 'single line without breaks';
    expect(normalizeLineEndings(input)).toBe(input);
  });
});

describe('computeLineDiff', () => {
  it('should treat CRLF and LF as equivalent', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\r\nline2\r\nline3';

    const result = computeLineDiff(oldText, newText);

    // All lines should be unchanged
    expect(result.every(line => line.type === 'unchanged')).toBe(true);
    expect(result.length).toBe(3);
  });

  it('should detect unchanged lines correctly', () => {
    const text = 'line1\nline2\nline3';
    const result = computeLineDiff(text, text);

    expect(result.length).toBe(3);
    expect(result.every(line => line.type === 'unchanged')).toBe(true);
  });

  it('should detect added lines', () => {
    const oldText = 'line1\nline3';
    const newText = 'line1\nline2\nline3';

    const result = computeLineDiff(oldText, newText);

    const addedLines = result.filter(line => line.type === 'added');
    expect(addedLines.length).toBe(1);
    expect(addedLines[0].newText).toBe('line2');
  });

  it('should detect removed lines', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nline3';

    const result = computeLineDiff(oldText, newText);

    const removedLines = result.filter(line => line.type === 'removed');
    expect(removedLines.length).toBe(1);
    expect(removedLines[0].oldText).toBe('line2');
  });

  it('should detect modified lines with character-level diff', () => {
    const oldText = 'Hello World';
    const newText = 'Hello Earth';

    const result = computeLineDiff(oldText, newText);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
    expect(result[0].oldText).toBe('Hello World');
    expect(result[0].newText).toBe('Hello Earth');
    expect(result[0].segments).toBeDefined();
  });

  it('should handle empty files', () => {
    const result = computeLineDiff('', '');
    expect(result.length).toBe(0);
  });

  it('should handle files with only whitespace changes', () => {
    const oldText = 'line with trailing space ';
    const newText = 'line with trailing space';

    const result = computeLineDiff(oldText, newText);

    // diff-match-patch may treat this as remove+add or modified depending on similarity
    // The key is that it detects a difference
    const hasChanges = result.some(l => l.type !== 'unchanged');
    expect(hasChanges).toBe(true);
  });

  it('should handle adding content to empty file', () => {
    const result = computeLineDiff('', 'new content');

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('added');
    expect(result[0].newText).toBe('new content');
  });

  it('should handle removing all content', () => {
    const result = computeLineDiff('old content', '');

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('removed');
    expect(result[0].oldText).toBe('old content');
  });

  it('should preserve line numbers for unchanged lines', () => {
    const text = 'line1\nline2\nline3';
    const result = computeLineDiff(text, text);

    expect(result[0].oldLineNumber).toBe(1);
    expect(result[0].newLineNumber).toBe(1);
    expect(result[1].oldLineNumber).toBe(2);
    expect(result[1].newLineNumber).toBe(2);
    expect(result[2].oldLineNumber).toBe(3);
    expect(result[2].newLineNumber).toBe(3);
  });

  it('should handle CRLF in middle of real changes', () => {
    // Only actual content change, not line ending change
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\r\nmodified line2\r\nline3';

    const result = computeLineDiff(oldText, newText);

    // After normalization, both have LF endings
    // The diff algorithm may represent the change as 'added' segment for 'modified '
    // (since 'line2' appears in both old and new, it's treated as unchanged)
    const changedLines = result.filter(line => line.type !== 'unchanged');
    expect(changedLines.length).toBeGreaterThan(0);

    // Verify the 'modified' text appears somewhere in the changes
    const hasModifiedText = changedLines.some(l => l.newText?.includes('modified'));
    expect(hasModifiedText).toBe(true);
  });
});

describe('calculateSimilarity', () => {
  it('should return 100 for identical text', () => {
    const text = 'Hello World';
    expect(calculateSimilarity(text, text)).toBe(100);
  });

  it('should return 100 for text differing only in line endings', () => {
    const lfText = 'line1\nline2\nline3';
    const crlfText = 'line1\r\nline2\r\nline3';

    expect(calculateSimilarity(lfText, crlfText)).toBe(100);
  });

  it('should return appropriate percentage for partial matches', () => {
    const oldText = 'Hello World';
    const newText = 'Hello Earth';

    const similarity = calculateSimilarity(oldText, newText);

    // Should be between 0 and 100, but not 100
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(100);
  });

  it('should handle empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(100);
  });

  it('should return low similarity for completely different text', () => {
    const similarity = calculateSimilarity('AAAAA', 'BBBBB');
    expect(similarity).toBe(0);
  });

  it('should handle one empty string', () => {
    expect(calculateSimilarity('text', '')).toBe(0);
    expect(calculateSimilarity('', 'text')).toBe(0);
  });
});

describe('createSimpleAlignedLines', () => {
  it('should create aligned output for unchanged content', () => {
    const text = 'line1\nline2';
    const result = createSimpleAlignedLines(text, text);

    expect(result.length).toBe(2);
    expect(result[0].type).toBe('unchanged');
    expect(result[0].oldText).toBe('line1');
    expect(result[0].newText).toBe('line1');
  });

  it('should handle removed lines', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nline3';

    const result = createSimpleAlignedLines(oldText, newText);

    const removedLine = result.find(l => l.type === 'removed');
    expect(removedLine).toBeDefined();
    expect(removedLine?.oldText).toBe('line2');
    expect(removedLine?.newText).toBeNull();
  });

  it('should handle added lines', () => {
    const oldText = 'line1\nline3';
    const newText = 'line1\nline2\nline3';

    const result = createSimpleAlignedLines(oldText, newText);

    const addedLine = result.find(l => l.type === 'added');
    expect(addedLine).toBeDefined();
    expect(addedLine?.oldText).toBeNull();
    expect(addedLine?.newText).toBe('line2');
  });

  it('should preserve line numbers correctly', () => {
    const text = 'line1\nline2\nline3';
    const result = createSimpleAlignedLines(text, text);

    expect(result[0].oldLineNumber).toBe(1);
    expect(result[0].newLineNumber).toBe(1);
    expect(result[2].oldLineNumber).toBe(3);
    expect(result[2].newLineNumber).toBe(3);
  });

  it('should handle CRLF vs LF with no false changes', () => {
    const lfText = 'line1\nline2\nline3';
    const crlfText = 'line1\r\nline2\r\nline3';

    const result = createSimpleAlignedLines(lfText, crlfText);

    // All lines should be unchanged
    expect(result.length).toBe(3);
    expect(result.every(line => line.type === 'unchanged')).toBe(true);
  });
});

describe('computeDiff', () => {
  it('should detect character-level insertions', () => {
    const result = computeDiff('Hello', 'Hello World');

    const insertions = result.filter(s => s.operation === DiffOperation.INSERT);
    expect(insertions.length).toBeGreaterThan(0);
  });

  it('should detect character-level deletions', () => {
    const result = computeDiff('Hello World', 'Hello');

    const deletions = result.filter(s => s.operation === DiffOperation.DELETE);
    expect(deletions.length).toBeGreaterThan(0);
  });

  it('should handle identical text', () => {
    const result = computeDiff('same', 'same');

    expect(result.length).toBe(1);
    expect(result[0].operation).toBe(DiffOperation.EQUAL);
    expect(result[0].text).toBe('same');
  });
});
