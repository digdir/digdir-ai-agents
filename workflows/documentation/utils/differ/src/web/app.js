/**
 * Frontend application for documentation review
 */

// State
let state = null;
let ws = null;
let nbEditor = null;
let enEditor = null;
let nbEdited = false;
let enEdited = false;
let showDiffDecorations = true;
let nbDecorations = [];
let enDecorations = [];

// DOM Elements
const elements = {
  sessionInfo: document.getElementById('sessionInfo'),
  columnsContainer: document.getElementById('columnsContainer'),
  colOldNb: document.getElementById('colOldNb'),
  colNewNb: document.getElementById('colNewNb'),
  colOldEn: document.getElementById('colOldEn'),
  colNewEn: document.getElementById('colNewEn'),
  oldNbMarkdown: document.getElementById('oldNbMarkdown'),
  newNbMarkdown: document.getElementById('newNbMarkdown'),
  oldEnMarkdown: document.getElementById('oldEnMarkdown'),
  newEnMarkdown: document.getElementById('newEnMarkdown'),
  nbEditorContainer: document.getElementById('nbEditorContainer'),
  enEditorContainer: document.getElementById('enEditorContainer'),
  editNbBtn: document.getElementById('editNbBtn'),
  editEnBtn: document.getElementById('editEnBtn'),
  nbSimilarity: document.getElementById('nbSimilarity'),
  enSimilarity: document.getElementById('enSimilarity'),
  nbFilePath: document.getElementById('nbFilePath'),
  enFilePath: document.getElementById('enFilePath'),
  commentCount: document.getElementById('commentCount'),
  commentsList: document.getElementById('commentsList'),
  newComment: document.getElementById('newComment'),
  addCommentBtn: document.getElementById('addCommentBtn'),
  commentsPanel: document.getElementById('commentsPanel'),
  approveBtn: document.getElementById('approveBtn'),
  rejectBtn: document.getElementById('rejectBtn'),
  loadingOverlay: document.getElementById('loadingOverlay')
};

/**
 * Initialize the application
 */
async function init() {
  showLoading(true);

  // Connect WebSocket
  connectWebSocket();

  // Fetch initial state
  await fetchState();

  // Setup event listeners
  setupEventListeners();

  showLoading(false);
}

/**
 * Connect to WebSocket for real-time updates
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'state') {
      state = message.data;
      render();
    } else if (message.type === 'comment_added') {
      fetchState();
    } else if (message.type === 'closed') {
      window.close();
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed, attempting reconnect...');
    setTimeout(connectWebSocket, 2000);
  };
}

/**
 * Fetch current state from API
 */
async function fetchState() {
  try {
    const response = await fetch('/api/state');
    if (response.ok) {
      state = await response.json();
      render();
    }
  } catch (error) {
    console.error('Failed to fetch state:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Edit buttons
  elements.editNbBtn.addEventListener('click', () => toggleEditor('nb'));
  elements.editEnBtn.addEventListener('click', () => toggleEditor('en'));

  // Comments
  elements.addCommentBtn.addEventListener('click', addComment);

  // Approve/Reject - no popup, uses inline comment
  elements.approveBtn.addEventListener('click', handleApprove);
  elements.rejectBtn.addEventListener('click', handleReject);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        handleApprove();
      }
    }
  });

  // Sync scroll between all columns
  setupScrollSync();
}

/**
 * Setup scroll synchronization between all columns
 */
function setupScrollSync() {
  const allColumns = [
    elements.colOldNb,
    elements.colNewNb,
    elements.colNewEn,
    elements.colOldEn
  ];

  let isScrolling = false;

  // Sync all columns together
  allColumns.forEach(sourceCol => {
    const sourceContent = sourceCol?.querySelector('.column-content');
    if (!sourceContent) return;

    sourceContent.addEventListener('scroll', () => {
      // Prevent feedback loop
      if (isScrolling) return;
      isScrolling = true;

      const maxScroll = sourceContent.scrollHeight - sourceContent.clientHeight;
      const scrollRatio = maxScroll > 0 ? sourceContent.scrollTop / maxScroll : 0;

      allColumns.forEach(targetCol => {
        if (targetCol === sourceCol) return;
        const targetContent = targetCol?.querySelector('.column-content');
        if (!targetContent) return;

        const targetMaxScroll = targetContent.scrollHeight - targetContent.clientHeight;
        if (targetMaxScroll > 0) {
          targetContent.scrollTop = scrollRatio * targetMaxScroll;
        }
      });

      // Reset flag after a short delay to allow the scroll to complete
      requestAnimationFrame(() => {
        isScrolling = false;
      });
    });
  });
}

/**
 * Render the current state
 */
function render() {
  if (!state) return;

  // Update header
  elements.sessionInfo.textContent = `Sesjon: ${state.sessionId}`;

  // Update file paths
  elements.nbFilePath.textContent = `NB: ${state.nb.filePath}`;
  elements.enFilePath.textContent = state.en ? `EN: ${state.en.filePath}` : '';

  // Update similarity badges
  updateSimilarityBadge(elements.nbSimilarity, state.nb.similarity, !state.nb.previous);
  if (state.en) {
    updateSimilarityBadge(elements.enSimilarity, state.en.similarity, !state.en.previous);
  }

  // Render content with aligned diff (both old and new columns)
  // Parse old front-matter from previous content for diff comparison
  const nbOldFm = state.nb.previous ? parseFrontMatter(state.nb.previous).frontMatter : null;
  const nbNewFm = state.nb.frontMatter;

  if (state.nb.alignedLines) {
    renderAlignedContent(elements.oldNbMarkdown, elements.newNbMarkdown, state.nb.alignedLines, nbOldFm, nbNewFm);
  } else {
    renderSimpleContent(elements.oldNbMarkdown, state.nb.previous, 'old');
    renderSimpleContent(elements.newNbMarkdown, state.nb.current, 'new');
  }

  if (state.en) {
    const enOldFm = state.en.previous ? parseFrontMatter(state.en.previous).frontMatter : null;
    const enNewFm = state.en.frontMatter;

    if (state.en.alignedLines) {
      renderAlignedContent(elements.oldEnMarkdown, elements.newEnMarkdown, state.en.alignedLines, enOldFm, enNewFm);
    } else {
      renderSimpleContent(elements.oldEnMarkdown, state.en.previous, 'old');
      renderSimpleContent(elements.newEnMarkdown, state.en.current, 'new');
    }
    elements.colOldEn.classList.remove('hidden');
    elements.colNewEn.classList.remove('hidden');
  } else {
    elements.colOldEn.classList.add('hidden');
    elements.colNewEn.classList.add('hidden');
    elements.columnsContainer.classList.add('mode-nb-only');
  }

  // Render comments
  renderComments();
}

/**
 * Update similarity badge styling
 */
function updateSimilarityBadge(element, similarity, isNew) {
  if (isNew) {
    element.textContent = 'Ny fil';
    element.classList.remove('high', 'medium', 'low');
    element.classList.add('new-file');
    return;
  }

  element.textContent = `${similarity}% lik`;
  element.classList.remove('high', 'medium', 'low', 'new-file');

  if (similarity >= 80) {
    element.classList.add('high');
  } else if (similarity >= 50) {
    element.classList.add('medium');
  } else {
    element.classList.add('low');
  }
}

/**
 * Parse front matter from content
 * Returns frontMatter as an object (parsed YAML-like format)
 */
function parseFrontMatter(content) {
  if (!content) return { frontMatter: null, body: content || '' };

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { frontMatter: null, body: content };

  const frontMatterText = match[1];
  const body = content.slice(match[0].length);

  // Parse YAML-like format into object (key: value pairs)
  const frontMatter = {};
  const lines = frontMatterText.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Try to parse as number or boolean
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      frontMatter[key] = value;
    }
  }

  return {
    frontMatter: Object.keys(frontMatter).length > 0 ? frontMatter : null,
    body
  };
}

/**
 * Render front matter as a styled block
 */
function renderFrontMatter(frontMatter) {
  if (!frontMatter) return '';

  // Handle both string and object front matter
  let fmText = frontMatter;
  if (typeof frontMatter === 'object') {
    fmText = Object.entries(frontMatter)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  const lines = fmText.split('\n').map(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      return `<span class="fm-key">${escapeHtml(key)}:</span> <span class="fm-value">${escapeHtml(value)}</span>`;
    }
    return escapeHtml(line);
  });

  return `<div class="front-matter"><div class="fm-delimiter">---</div>${lines.join('<br>')}<div class="fm-delimiter">---</div></div>`;
}

/**
 * Render front matter with diff highlighting
 */
function renderFrontMatterWithDiff(oldFm, newFm, mode) {
  // Convert to objects if needed
  const oldObj = typeof oldFm === 'object' ? oldFm : {};
  const newObj = typeof newFm === 'object' ? newFm : {};

  // Get all keys from both
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  if (allKeys.size === 0) return '';

  let lines = [];

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    const oldStr = oldVal !== undefined ? String(oldVal) : '';
    const newStr = newVal !== undefined ? String(newVal) : '';

    let lineClass = '';
    let displayVal = '';

    if (mode === 'old') {
      if (oldVal === undefined) {
        // Key doesn't exist in old - show as padding
        lineClass = 'fm-line-padding';
        displayVal = '';
      } else if (newVal === undefined) {
        // Key removed in new - show as removed
        lineClass = 'fm-line-removed';
        displayVal = oldStr;
      } else if (oldStr !== newStr) {
        // Value changed - show old value as modified
        lineClass = 'fm-line-modified';
        displayVal = oldStr;
      } else {
        // Unchanged
        displayVal = oldStr;
      }
    } else {
      // mode === 'new'
      if (newVal === undefined) {
        // Key removed in new - show as padding
        lineClass = 'fm-line-padding';
        displayVal = '';
      } else if (oldVal === undefined) {
        // Key added in new - show as added
        lineClass = 'fm-line-added';
        displayVal = newStr;
      } else if (oldStr !== newStr) {
        // Value changed - show new value as modified
        lineClass = 'fm-line-modified';
        displayVal = newStr;
      } else {
        // Unchanged
        displayVal = newStr;
      }
    }

    if (lineClass === 'fm-line-padding') {
      lines.push(`<div class="fm-line ${lineClass}">&nbsp;</div>`);
    } else {
      const keyHtml = `<span class="fm-key">${escapeHtml(key)}:</span>`;
      const valHtml = `<span class="fm-value">${escapeHtml(displayVal)}</span>`;
      lines.push(`<div class="fm-line ${lineClass}">${keyHtml} ${valHtml}</div>`);
    }
  }

  return `<div class="front-matter"><div class="fm-delimiter">---</div>${lines.join('')}<div class="fm-delimiter">---</div></div>`;
}

/**
 * Create Monaco decorations from aligned lines
 */
function createDecorations(alignedLines) {
  const decorations = [];
  let editorLineNum = 0;

  for (const line of alignedLines) {
    const { type, newLineNumber, segments } = line;

    // Skip lines that don't exist in the new content (removed lines)
    if (type === 'removed') {
      continue;
    }

    editorLineNum++;

    if (type === 'added') {
      decorations.push({
        range: new monaco.Range(editorLineNum, 1, editorLineNum, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-diff-added-line',
          glyphMarginClassName: 'monaco-diff-added-glyph'
        }
      });
    } else if (type === 'modified') {
      decorations.push({
        range: new monaco.Range(editorLineNum, 1, editorLineNum, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-diff-modified-line',
          glyphMarginClassName: 'monaco-diff-modified-glyph'
        }
      });

      // Add inline decorations for character-level changes
      if (segments) {
        let charPos = 1;
        for (const segment of segments) {
          if (segment.operation === 1) { // INSERT
            decorations.push({
              range: new monaco.Range(editorLineNum, charPos, editorLineNum, charPos + segment.text.length),
              options: {
                inlineClassName: 'monaco-diff-inserted-text'
              }
            });
          }
          // Only count characters that are in the new content
          if (segment.operation !== -1) { // Not DELETE
            charPos += segment.text.length;
          }
        }
      }
    }
  }

  return decorations;
}

/**
 * Render aligned content with proper diff visualization
 * This renders both old and new columns together, keeping lines aligned
 */
function renderAlignedContent(oldElement, newElement, alignedLines, oldFrontMatter, newFrontMatter) {
  // If only one frontMatter provided (old API), use it for both
  if (newFrontMatter === undefined) {
    newFrontMatter = oldFrontMatter;
  }

  // Use diff-aware rendering when we have both old and new front-matter
  const oldFmHtml = renderFrontMatterWithDiff(oldFrontMatter, newFrontMatter, 'old');
  const newFmHtml = renderFrontMatterWithDiff(oldFrontMatter, newFrontMatter, 'new');

  let oldHtml = '<div class="line-numbered-content">';
  let newHtml = '<div class="line-numbered-content">';

  for (const line of alignedLines) {
    const { type, oldLineNumber, newLineNumber, oldText, newText, segments } = line;

    // Render old column
    if (type === 'unchanged') {
      oldHtml += renderLine(oldLineNumber, oldText, 'unchanged', null, 'old');
      newHtml += renderLine(newLineNumber, newText, 'unchanged', null, 'new');
    } else if (type === 'modified') {
      oldHtml += renderLine(oldLineNumber, oldText, 'modified', segments, 'old');
      newHtml += renderLine(newLineNumber, newText, 'modified', segments, 'new');
    } else if (type === 'removed') {
      oldHtml += renderLine(oldLineNumber, oldText, 'removed', null, 'old');
      newHtml += renderLine(null, '', 'padding', null, 'new');
    } else if (type === 'added') {
      oldHtml += renderLine(null, '', 'padding', null, 'old');
      newHtml += renderLine(newLineNumber, newText, 'added', null, 'new');
    }
  }

  oldHtml += '</div>';
  newHtml += '</div>';

  oldElement.innerHTML = oldFmHtml + oldHtml;
  newElement.innerHTML = newFmHtml + newHtml;
}

/**
 * Render a single line with line number and diff styling
 */
function renderLine(lineNumber, text, type, segments, mode) {
  if (type === 'padding') {
    return `<div class="line line-padding"><span class="line-number"></span><span class="line-content"></span></div>`;
  }

  const lineNumDisplay = lineNumber !== null ? lineNumber : '';
  let lineClass = 'line';

  if (type === 'added') lineClass += ' line-added';
  else if (type === 'removed') lineClass += ' line-removed';
  else if (type === 'modified') lineClass += ' line-modified';

  let content;
  let contentClass = 'line-content';

  if (segments && segments.length > 0) {
    // For lines with segments (modified), add heading class here
    // since renderLineWithSegments doesn't add it
    content = renderLineWithSegments(text || '', segments, mode);
    const headingMatch = (text || '').match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      contentClass += ` md-heading md-h${level}`;
    }
  } else {
    // For lines without segments, renderMarkdownLine adds heading styling internally
    content = renderMarkdownLine(text || '');
  }

  return `<div class="${lineClass}"><span class="line-number">${lineNumDisplay}</span><span class="${contentClass}">${content}</span></div>`;
}

/**
 * Render line with inline diff segments
 */
function renderLineWithSegments(text, segments, mode) {
  let html = '';

  for (const segment of segments) {
    const segText = escapeHtml(segment.text);

    if (segment.operation === -1) { // DELETE
      if (mode === 'old') {
        html += `<del class="diff-del">${segText}</del>`;
      }
      // Skip deleted text in new view
    } else if (segment.operation === 1) { // INSERT
      if (mode === 'new') {
        html += `<ins class="diff-ins">${segText}</ins>`;
      }
      // Skip inserted text in old view
    } else { // EQUAL
      html += segText;
    }
  }

  return html || '&nbsp;';
}

/**
 * Render simple content (for new files without previous version)
 */
function renderSimpleContent(element, content, mode) {
  if (!content && mode === 'old') {
    element.innerHTML = `
      <div class="new-file-placeholder">
        <div class="new-file-icon">+</div>
        <div class="new-file-text">Ny fil</div>
        <div class="new-file-subtext">Ingen tidligere versjon</div>
      </div>
    `;
    return;
  }

  if (!content) {
    element.innerHTML = '<div class="empty-content">Ingen innhold</div>';
    return;
  }

  const { frontMatter, body } = parseFrontMatter(content);
  const fmHtml = renderFrontMatter(frontMatter);

  const lines = body.split('\n');
  let linesHtml = '<div class="line-numbered-content">';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const lineContent = renderMarkdownLine(line);
    linesHtml += `<div class="line"><span class="line-number">${lineNum}</span><span class="line-content">${lineContent}</span></div>`;
  });

  linesHtml += '</div>';
  element.innerHTML = fmHtml + linesHtml;
}

/**
 * Render a single line with basic markdown styling
 */
function renderMarkdownLine(line) {
  if (!line) return '&nbsp;';

  let html = escapeHtml(line);

  // Headings
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return `<span class="md-heading md-h${level}">${html}</span>`;
  }

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // List items
  if (line.match(/^\s*[-*+]\s/)) {
    html = `<span class="md-list-item">${html}</span>`;
  }

  // Numbered list
  if (line.match(/^\s*\d+\.\s/)) {
    html = `<span class="md-list-item">${html}</span>`;
  }

  return html;
}

/**
 * Render comments list
 */
function renderComments() {
  if (!state || !state.comments) {
    elements.commentCount.textContent = '(0)';
    elements.commentsList.innerHTML = '<p class="no-comments">Ingen kommentarer ennå</p>';
    return;
  }

  elements.commentCount.textContent = `(${state.comments.length})`;

  if (state.comments.length === 0) {
    elements.commentsList.innerHTML = '<p class="no-comments">Ingen kommentarer ennå</p>';
    return;
  }

  elements.commentsList.innerHTML = state.comments.map(comment => `
    <div class="comment-item ${comment.author === 'human' ? 'comment-human' : 'comment-ai'}">
      <div class="author">${comment.author === 'human' ? 'Du' : 'AI'} - ${formatDate(comment.timestamp)}</div>
      <div class="text">${escapeHtml(comment.text)}</div>
    </div>
  `).join('');
}

/**
 * Toggle editor for a language
 */
async function toggleEditor(lang) {
  const container = lang === 'nb' ? elements.nbEditorContainer : elements.enEditorContainer;
  const markdownView = lang === 'nb' ? elements.newNbMarkdown : elements.newEnMarkdown;
  const oldMarkdownView = lang === 'nb' ? elements.oldNbMarkdown : elements.oldEnMarkdown;
  const button = lang === 'nb' ? elements.editNbBtn : elements.editEnBtn;
  const content = lang === 'nb' ? state.nb.current : state.en?.current;
  const frontMatter = lang === 'nb' ? state.nb.frontMatter : state.en?.frontMatter;
  const previousContent = lang === 'nb' ? state.nb.previous : state.en?.previous;

  const isEditing = !container.classList.contains('hidden');

  if (isEditing) {
    // Close editor - return to preview mode
    container.classList.add('hidden');
    markdownView.classList.remove('hidden');
    button.textContent = 'Rediger';

    // Get content from editor and update state
    const editor = lang === 'nb' ? nbEditor : enEditor;
    if (editor) {
      const newContent = editor.getValue();
      if (lang === 'nb') {
        state.nb.current = newContent;
        nbEdited = true;
      } else {
        state.en.current = newContent;
        enEdited = true;
      }

      // Parse front-matter from both old and new content
      const { frontMatter: newFrontMatter } = parseFrontMatter(newContent);
      const { frontMatter: oldFrontMatter } = parseFrontMatter(previousContent || '');

      // Update state with new front-matter
      if (lang === 'nb') {
        state.nb.frontMatter = newFrontMatter;
      } else {
        state.en.frontMatter = newFrontMatter;
      }

      // Recompute diff between previous (original) and current (edited) content
      if (previousContent) {
        try {
          const response = await fetch('/api/compute-diff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oldContent: previousContent,
              newContent: newContent
            })
          });

          if (response.ok) {
            const { alignedLines, similarity } = await response.json();

            // Update state with new diff
            if (lang === 'nb') {
              state.nb.alignedLines = alignedLines;
              state.nb.similarity = similarity;
              updateSimilarityBadge(elements.nbSimilarity, similarity, false);
            } else {
              state.en.alignedLines = alignedLines;
              state.en.similarity = similarity;
              updateSimilarityBadge(elements.enSimilarity, similarity, false);
            }

            // Re-render with new aligned diff - old FM for old column, new FM for new column
            renderAlignedContent(oldMarkdownView, markdownView, alignedLines, oldFrontMatter, newFrontMatter);
          } else {
            // Fallback to simple render
            renderSimpleContent(markdownView, newContent, 'new');
          }
        } catch (error) {
          console.error('Failed to compute diff:', error);
          renderSimpleContent(markdownView, newContent, 'new');
        }
      } else {
        // No previous content (new file), just render the new content
        renderSimpleContent(markdownView, newContent, 'new');
      }
    }
  } else {
    // Open editor
    container.classList.remove('hidden');
    markdownView.classList.add('hidden');
    button.textContent = 'Forhåndsvis';

    // Initialize Monaco editor if not already done
    if (lang === 'nb' && !nbEditor) {
      nbEditor = monaco.editor.create(container, {
        value: content,
        language: 'markdown',
        theme: 'vs-dark',
        minimap: { enabled: false },
        wordWrap: 'on',
        lineNumbers: 'on',
        fontSize: 14,
        automaticLayout: true,
        glyphMargin: true
      });
    } else if (lang === 'en' && !enEditor) {
      enEditor = monaco.editor.create(container, {
        value: content,
        language: 'markdown',
        theme: 'vs-dark',
        minimap: { enabled: false },
        wordWrap: 'on',
        lineNumbers: 'on',
        fontSize: 14,
        automaticLayout: true,
        glyphMargin: true
      });
    } else {
      const editor = lang === 'nb' ? nbEditor : enEditor;
      editor?.setValue(content);
    }

    // Apply diff decorations to the editor
    if (showDiffDecorations && alignedLines) {
      const editor = lang === 'nb' ? nbEditor : enEditor;
      const decorations = lang === 'nb' ? nbDecorations : enDecorations;
      const newDecorations = editor.deltaDecorations(decorations, createDecorations(alignedLines));
      if (lang === 'nb') {
        nbDecorations = newDecorations;
      } else {
        enDecorations = newDecorations;
      }
    }
  }
}

/**
 * Add a comment
 */
async function addComment() {
  const text = elements.newComment.value.trim();
  if (!text) return;

  try {
    const response = await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (response.ok) {
      elements.newComment.value = '';
      await fetchState();
    }
  } catch (error) {
    console.error('Failed to add comment:', error);
  }
}

/**
 * Handle approve button click
 */
async function handleApprove() {
  showLoading(true);

  try {
    const body = {};

    // Include edited content if editors were used
    if (nbEditor) {
      body.nbContent = nbEditor.getValue();
    }
    if (enEditor) {
      body.enContent = enEditor.getValue();
    }

    const response = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to approve');
    }
  } catch (error) {
    console.error('Approve failed:', error);
    showLoading(false);
    alert('Kunne ikke godkjenne. Prøv igjen.');
  }
}

/**
 * Handle reject - uses inline comment field instead of popup
 */
async function handleReject() {
  const feedback = elements.newComment.value.trim();

  if (!feedback) {
    elements.newComment.focus();
    elements.newComment.placeholder = 'Skriv tilbakemelding før du avviser...';
    elements.newComment.classList.add('highlight-required');
    setTimeout(() => {
      elements.newComment.classList.remove('highlight-required');
      elements.newComment.placeholder = 'Skriv tilbakemelding her (brukes ved avvisning)...';
    }, 2000);
    return;
  }

  showLoading(true);

  try {
    const body = { feedback };

    // Include edited content if editors were used
    if (nbEditor) {
      body.nbContent = nbEditor.getValue();
    }
    if (enEditor) {
      body.enContent = enEditor.getValue();
    }

    const response = await fetch('/api/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to reject');
    }

    elements.newComment.value = '';
  } catch (error) {
    console.error('Reject failed:', error);
    showLoading(false);
    alert('Kunne ikke sende tilbakemelding. Prøv igjen.');
  }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  elements.loadingOverlay.classList.toggle('hidden', !show);
}

/**
 * Format date for display
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
