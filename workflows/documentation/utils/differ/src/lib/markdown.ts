/**
 * Markdown parsing and rendering with diff highlighting
 */

import { marked } from 'marked';
import { DiffSegment, DiffOperation, computeDiff } from './diff.js';

export interface MarkdownSection {
  level: number;
  title: string;
  anchor: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ParsedMarkdown {
  frontMatter: Record<string, unknown> | null;
  body: string;
  sections: MarkdownSection[];
  rawContent: string;
}

/**
 * Parse front matter from markdown content
 */
export function parseFrontMatter(content: string): {
  frontMatter: Record<string, unknown> | null;
  body: string;
} {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: null, body: content };
  }

  const frontMatterText = match[1];
  const body = content.slice(match[0].length);

  // Simple YAML-like parsing (key: value)
  const frontMatter: Record<string, unknown> = {};
  const lines = frontMatterText.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: string | boolean | number = line.slice(colonIndex + 1).trim();

      // Try to parse as number or boolean
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      frontMatter[key] = value;
    }
  }

  return { frontMatter, body };
}

/**
 * Parse markdown into sections based on headings
 */
export function parseMarkdownSections(content: string): ParsedMarkdown {
  const { frontMatter, body } = parseFrontMatter(content);
  const lines = body.split('\n');
  const sections: MarkdownSection[] = [];

  let currentSection: MarkdownSection | null = null;
  let lineNum = content.indexOf(body) > 0
    ? content.slice(0, content.indexOf(body)).split('\n').length
    : 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endLine = lineNum - 1;
        sections.push(currentSection);
      }

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      currentSection = {
        level,
        title,
        anchor,
        content: line,
        startLine: lineNum,
        endLine: lineNum
      };
    } else if (currentSection) {
      currentSection.content += '\n' + line;
    } else {
      // Content before first heading
      if (!currentSection) {
        currentSection = {
          level: 0,
          title: '',
          anchor: 'intro',
          content: line,
          startLine: lineNum,
          endLine: lineNum
        };
      }
    }

    lineNum++;
  }

  // Add last section
  if (currentSection) {
    currentSection.endLine = lineNum - 1;
    sections.push(currentSection);
  }

  return {
    frontMatter,
    body,
    sections,
    rawContent: content
  };
}

/**
 * Render markdown to HTML with styling
 */
export async function renderMarkdown(content: string): Promise<string> {
  const { body } = parseFrontMatter(content);

  // Configure marked for safe rendering
  marked.setOptions({
    gfm: true,
    breaks: false
  });

  return await marked(body);
}

/**
 * Render markdown with diff highlighting
 * Applies diff segments to produce HTML with added/removed markers
 */
export function renderMarkdownWithDiff(
  oldContent: string,
  newContent: string
): { oldHtml: string; newHtml: string; diffHtml: string } {
  const { body: oldBody } = parseFrontMatter(oldContent);
  const { body: newBody } = parseFrontMatter(newContent);

  const diffSegments = computeDiff(oldBody, newBody);

  // Build diff HTML with markers
  let diffHtml = '';
  for (const segment of diffSegments) {
    const escaped = escapeHtml(segment.text);
    switch (segment.operation) {
      case DiffOperation.DELETE:
        diffHtml += `<del class="diff-del">${escaped}</del>`;
        break;
      case DiffOperation.INSERT:
        diffHtml += `<ins class="diff-ins">${escaped}</ins>`;
        break;
      default:
        diffHtml += escaped;
    }
  }

  return {
    oldHtml: marked.parse(oldBody) as string,
    newHtml: marked.parse(newBody) as string,
    diffHtml: `<pre class="diff-view">${diffHtml}</pre>`
  };
}

/**
 * Align sections between two documents for side-by-side view
 * Matches sections by heading level and title similarity
 */
export function alignSections(
  nbSections: MarkdownSection[],
  enSections: MarkdownSection[]
): Array<{ nb: MarkdownSection | null; en: MarkdownSection | null }> {
  const aligned: Array<{ nb: MarkdownSection | null; en: MarkdownSection | null }> = [];
  const usedEnIndices = new Set<number>();

  for (const nbSection of nbSections) {
    // Try to find matching English section by level
    let bestMatch: { index: number; score: number } | null = null;

    for (let i = 0; i < enSections.length; i++) {
      if (usedEnIndices.has(i)) continue;

      const enSection = enSections[i];

      // Must be same level to match
      if (enSection.level !== nbSection.level) continue;

      // Calculate simple position-based score
      const positionScore = 1 - Math.abs(
        nbSections.indexOf(nbSection) - i
      ) / Math.max(nbSections.length, enSections.length);

      if (!bestMatch || positionScore > bestMatch.score) {
        bestMatch = { index: i, score: positionScore };
      }
    }

    if (bestMatch && bestMatch.score > 0.3) {
      usedEnIndices.add(bestMatch.index);
      aligned.push({
        nb: nbSection,
        en: enSections[bestMatch.index]
      });
    } else {
      aligned.push({ nb: nbSection, en: null });
    }
  }

  // Add any unmatched English sections
  for (let i = 0; i < enSections.length; i++) {
    if (!usedEnIndices.has(i)) {
      aligned.push({ nb: null, en: enSections[i] });
    }
  }

  return aligned;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}
