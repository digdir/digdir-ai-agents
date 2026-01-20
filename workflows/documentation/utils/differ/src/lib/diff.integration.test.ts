/**
 * Integration tests for diff functions using fixtures
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  computeLineDiff,
  createSimpleAlignedLines,
  calculateSimilarity
} from './diff.js';
import { parseMarkdownSections } from './markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, '../../test-fixtures');

interface FixtureExpectation {
  description: string;
  expectedChanges?: number;
  allUnchanged?: boolean;
  hasModified?: boolean;
  hasAdded?: boolean;
  hasRemoved?: boolean;
  frontMatterChanged?: boolean;
  bodyUnchanged?: boolean;
}

function readFixture(fixtureName: string, fileName: string): string {
  const filePath = path.join(fixturesDir, fixtureName, fileName);
  return fs.readFileSync(filePath, 'utf8');
}

function readExpectation(fixtureName: string): FixtureExpectation {
  const filePath = path.join(fixturesDir, fixtureName, 'expected.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function summarizeDiff(lines: ReturnType<typeof computeLineDiff>) {
  return {
    total: lines.length,
    unchanged: lines.filter(l => l.type === 'unchanged').length,
    added: lines.filter(l => l.type === 'added').length,
    removed: lines.filter(l => l.type === 'removed').length,
    modified: lines.filter(l => l.type === 'modified').length
  };
}

describe('diff integration tests', () => {
  describe('crlf-vs-lf fixture', () => {
    it('should treat CRLF and LF as equivalent - all lines unchanged', () => {
      const oldContent = readFixture('crlf-vs-lf', 'old.md');
      const newContent = readFixture('crlf-vs-lf', 'new.md');
      const expected = readExpectation('crlf-vs-lf');

      const result = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(result);

      // Key assertion: CRLF vs LF should produce NO changes
      expect(summary.added).toBe(0);
      expect(summary.removed).toBe(0);
      expect(summary.modified).toBe(0);

      if (expected.allUnchanged) {
        expect(result.every(l => l.type === 'unchanged')).toBe(true);
      }
    });

    it('should have 100% similarity between CRLF and LF versions', () => {
      const oldContent = readFixture('crlf-vs-lf', 'old.md');
      const newContent = readFixture('crlf-vs-lf', 'new.md');

      const similarity = calculateSimilarity(oldContent, newContent);
      expect(similarity).toBe(100);
    });
  });

  describe('simple-edit fixture', () => {
    it('should detect modified line', () => {
      const oldContent = readFixture('simple-edit', 'old.md');
      const newContent = readFixture('simple-edit', 'new.md');
      const expected = readExpectation('simple-edit');

      const result = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(result);

      if (expected.hasModified) {
        expect(summary.modified).toBeGreaterThan(0);
      }

      // Most lines should be unchanged
      expect(summary.unchanged).toBeGreaterThan(summary.modified);
    });

    it('should produce aligned lines with correct types', () => {
      const oldContent = readFixture('simple-edit', 'old.md');
      const newContent = readFixture('simple-edit', 'new.md');

      const aligned = createSimpleAlignedLines(oldContent, newContent);

      const modifiedLine = aligned.find(l => l.type === 'modified');
      expect(modifiedLine).toBeDefined();
      expect(modifiedLine?.oldText).toContain('original');
      expect(modifiedLine?.newText).toContain('modified');
    });
  });

  describe('added-content fixture', () => {
    it('should detect added lines', () => {
      const oldContent = readFixture('added-content', 'old.md');
      const newContent = readFixture('added-content', 'new.md');
      const expected = readExpectation('added-content');

      const result = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(result);

      if (expected.hasAdded) {
        expect(summary.added).toBeGreaterThan(0);
      }
    });

    it('should preserve existing content as unchanged', () => {
      const oldContent = readFixture('added-content', 'old.md');
      const newContent = readFixture('added-content', 'new.md');

      const result = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(result);

      // Original lines should still be present and unchanged
      expect(summary.unchanged).toBeGreaterThan(0);
    });
  });

  describe('removed-content fixture', () => {
    it('should detect removed lines', () => {
      const oldContent = readFixture('removed-content', 'old.md');
      const newContent = readFixture('removed-content', 'new.md');
      const expected = readExpectation('removed-content');

      const result = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(result);

      if (expected.hasRemoved) {
        expect(summary.removed).toBeGreaterThan(0);
      }
    });
  });

  describe('front-matter-change fixture', () => {
    it('should detect front-matter changes when parsing separately', () => {
      const oldContent = readFixture('front-matter-change', 'old.md');
      const newContent = readFixture('front-matter-change', 'new.md');
      const expected = readExpectation('front-matter-change');

      const oldParsed = parseMarkdownSections(oldContent);
      const newParsed = parseMarkdownSections(newContent);

      if (expected.frontMatterChanged) {
        expect(oldParsed.frontMatter?.title).not.toBe(newParsed.frontMatter?.title);
      }
    });

    it('should show body as unchanged when only front-matter changes', () => {
      const oldContent = readFixture('front-matter-change', 'old.md');
      const newContent = readFixture('front-matter-change', 'new.md');
      const expected = readExpectation('front-matter-change');

      const oldParsed = parseMarkdownSections(oldContent);
      const newParsed = parseMarkdownSections(newContent);

      // Diff the body only
      const bodyDiff = computeLineDiff(oldParsed.body, newParsed.body);
      const summary = summarizeDiff(bodyDiff);

      if (expected.bodyUnchanged) {
        expect(summary.added).toBe(0);
        expect(summary.removed).toBe(0);
        expect(summary.modified).toBe(0);
      }
    });

    it('should detect front-matter diff when diffing full content', () => {
      const oldContent = readFixture('front-matter-change', 'old.md');
      const newContent = readFixture('front-matter-change', 'new.md');

      // Diff the full content including front-matter
      const fullDiff = computeLineDiff(oldContent, newContent);
      const summary = summarizeDiff(fullDiff);

      // Should have changes (in front-matter)
      expect(summary.modified + summary.added + summary.removed).toBeGreaterThan(0);
    });
  });
});

describe('edge cases', () => {
  it('should handle empty files', () => {
    const result = computeLineDiff('', '');
    expect(result.length).toBe(0);
  });

  it('should handle file with only newlines (CRLF)', () => {
    const crlfOnly = '\r\n\r\n\r\n';
    const lfOnly = '\n\n\n';

    const result = computeLineDiff(lfOnly, crlfOnly);
    const summary = summarizeDiff(result);

    // Empty lines with different endings should still match
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
  });

  it('should handle mixed CRLF and LF in same file', () => {
    const mixed = 'line1\r\nline2\nline3\r\nline4';
    const lfOnly = 'line1\nline2\nline3\nline4';

    const result = computeLineDiff(lfOnly, mixed);
    const summary = summarizeDiff(result);

    // Should all be unchanged after normalization
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.modified).toBe(0);
    expect(summary.unchanged).toBe(4);
  });
});
