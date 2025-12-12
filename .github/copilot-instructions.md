# AI Model-Specific Instructions

This document contains instructions for GitHub Copilot  

## GitHub Copilot: Primary Instructions

**As GitHub Copilot, you MUST follow these instructions:**

This repository contains AI-assisted documentation workflows for creating high-quality Norwegian and English technical documentation, primarily for Altinn projects.

**Your primary agent files** are located in `.github/agents/`:
- `technical-writer.agent.md` - Technical writing standards and practices  
- `language-editor-nb.agent.md` - Norwegian (Bokmål) language guidelines and Klarspråk principles
- `language-editor-en.agent.md` - English language guidelines and plain language principles

**NEVER** use instructions from `workflows/documentation/CLAUDE.md` or the `.claude/` directory.

**Link hygiene requirements:** Before you finish a documentation task, validate every internal link. Confirm that the language prefix (`/nb/` or `/en/`) is correct and that the anchor slug (`#...`) exists in the target file. When possible, run `hyperlink --check-anchors --sources content/ public/` locally; otherwise manually inspect the target file to ensure the heading is present and spelled identically.

---

## Documentation Guidelines 

### Primary Reference Files
When working on documentation tasks, **always** refer to these files:

**Common files:**
1. **`workflows/documentation/WRITING-GUIDE.md`** - Writing style and quality guidelines
2. **`workflows/documentation/TERMINOLOGY.md`** - Approved terminology and translations

**GitHub Copilot specific files:**
3. **`.github/agents/technical-writer.agent.md`** - Technical writing standards
4. **`.github/agents/language-editor-nb.agent.md`** - Norwegian guidelines  
5. **`.github/agents/language-editor-en.agent.md`** - English guidelines

### CRITICAL: Read Agent Guidelines Before Writing

**BEFORE creating any documentation, you MUST:**
1. Read the relevant language-editor file (nb.agent.md for Norwegian, en.agent.md for English)
2. Read technical-writer.agent.md for overall documentation standards
3. Apply these guidelines consistently throughout your work

This ensures compliance with Klarspråk principles (Norwegian) and plain language standards (English).

### MANDATORY: Documentation Structure Checklist

**BEFORE submitting any documentation, VERIFY:**

#### Structure Requirements:
1. **Single front matter block** - Never duplicate YAML front matter
2. **Consistent section structure**:
   - `## Introduksjon` (Norwegian) / `## Introduction` (English)
   - `## [Main content sections]`
   - `### [Subsections]`
3. **Check existing similar docs** - Use same structure as comparable files
4. **Identical structure** between Norwegian and English versions

#### Quality Checks:
1. **Compare with existing docs** in same category (explanation/guides/reference)
2. **Verify Hugo shortcodes** render correctly
3. **Test locally** with `hugo server` before committing
4. **Run PII check** before creating PR

#### Common Mistakes to Avoid:
- ❌ Duplicate front matter blocks
- ❌ Missing "Introduksjon"/"Introduction" sections
- ❌ Inconsistent heading levels
- ❌ Different structure between language versions
- ❌ Language-neutral internal links; always include the correct `/nb/` or `/en/` prefix for cross-language navigation

### Documentation Principles

#### Language Requirements
- **Always write Norwegian (bokmål) first, then English**
- Use conservative Norwegian bokmål forms
- Follow approved translations from TERMINOLOGY.md
- Both versions must have identical structure and front matter

#### File Naming Convention
- Norwegian: `_index.nb.md`
- English: `_index.en.md`

#### Front Matter Structure
```yaml
---
title: Title in Target Language
description: "Clear, concise description"
linktitle: Short Menu Title
tags: [relevant, tags]
weight: XX  # Ordering number
---
```

### Documentation Workflow Checklist

**MANDATORY: Follow these steps in order when creating/updating documentation:**

1. **Fetch requirements** - Get issue details with `gh issue view [number]` and capture the acceptance criteria or requested documentation scope.
2. **Clone or update required repositories** - Use `gh repo clone` or `git pull` to ensure `altinn-studio-docs` (and any referenced repos like `altinn-notifications`) are available locally in `workflows/documentation/repos/`.
3. **Explore existing docs** - Check where similar documentation exists
4. **Read agent guidelines** - Review technical-writer.md and language-editor files
5. **Plan structure and content** - Outline the document before writing:
   - Start with an introduction that explains the concept or change
   - Add technical details with concrete examples
   - Provide practical guidance and recommendations
   - Include info or warning callouts where important
6. **Write Norwegian first** - Follow Klarspråk principles from language-editor-nb.md
7. **Translate to English** - Maintain identical structure using language-editor-en.md
8. **START HUGO SERVER** - Navigate to `workflows/documentation/repos/altinn-studio-docs` and run `hugo server --navigateToChanged`
9. **Preview documentation** - Visit http://localhost:1313/ and verify rendering
10. **Run PII check** - Execute `python utils/pii-check/pii-check.py`
   - **CRITICAL**: If PII warnings are found (phone numbers, org numbers, fnr):
     - **STOP** - Do NOT automatically add to permitted-data.config
     - **SHOW** the user all detected values with file locations
     - **ASK** user: "These values were found in the documentation. Are these approved test data that should be added to permitted-data.config, or should they be replaced?"
     - **WAIT** for user confirmation before adding to permitted list
     - **ONLY ADD** to permitted-data.config after explicit user approval
11. **Create PR** - Only after all above steps pass

### Testing Documentation

### Common Patterns

#### API Documentation
- Include request/response examples
- Document all parameters
- Show error handling
- Provide authentication details

## Commands Reference

### GitHub CLI
```bash
# Fetch issue details
gh issue view [number] --repo [owner/repo]

# Create PR
gh pr create --title "Title" --body "Description"
```

### Hugo
```bash
# Start local server (MUST be run from altinn-studio-docs directory)
cd workflows/documentation/repos/altinn-studio-docs
hugo server --navigateToChanged

# Access at http://localhost:1313/
```

### PII Check
```bash
# Check for sensitive data
cd workflows/documentation
python utils/pii-check/pii-check.py --root-folder [path]
```

## Example Workflow

```bash
# 1. Fetch requirements (issue scope and acceptance criteria)
gh issue view 1098 --repo Altinn/altinn-notifications

# 2. Clone documentation repo (if needed)
cd workflows/documentation/repos
gh repo clone Altinn/altinn-studio-docs

# 3. Explore existing structure
cd workflows/documentation/repos/altinn-studio-docs
find content -name "*.nb.md" | grep [topic]

# 4. Plan structure and outline key sections (notes or docs)
Introduksjon → technical details → guidance → callouts

# 5. Create feature branch
git checkout -b docs/new-feature

# 6. Write Norwegian version first, following Klarspråk principles
code content/[path]/_index.nb.md

# 7. Translate to English with identical structure
code content/[path]/_index.en.md

# 8. Start Hugo server to preview changes
hugo server --navigateToChanged
# Open http://localhost:1313/ in browser and verify rendering

# 9. Run PII check on updated content
cd ../../utils/pii-check
python pii-check.py --root-folder ../../repos/altinn-studio-docs/content/[path] \
            --config-file permitted-data.config

# 10. Commit and create PR once all checks pass
cd ../../repos/altinn-studio-docs
git add content/[path]
git commit -m "Add documentation for [feature]"
git push -u origin docs/new-feature
gh pr create --title "Add documentation for [feature]" --body "..."
```

## Workspace and Git Repository Management

### Multi-Root Workspace Configuration

This repository uses a VS Code multi-root workspace (`digdir-ai-agents.code-workspace`) to manage multiple Git repositories independently.

**When cloning or adding a new Git repository to `workflows/documentation/repos/`:**

1. **Update the workspace file** `digdir-ai-agents.code-workspace`:
   ```jsonc
   {
     "folders": [
       {
         "path": "."
       },
       {
         "path": "workflows/documentation/repos/[new-repo-name]"
       }
     ]
   }
   ```

2. **Why this is important:**
   - Each nested Git repo gets its own Source Control section in VS Code
   - Prevents confusion between the parent repo and nested repos
   - Allows independent Git operations for each repository
   - Makes it clear which repo you're committing to

3. **Example workflow when adding a new documentation repo:**
   ```bash
   # Clone new repo
   cd workflows/documentation/repos
   gh repo clone [owner]/[repo-name]
   
   # Then update digdir-ai-agents.code-workspace to include:
   # { "path": "workflows/documentation/repos/[repo-name]" }
   ```

4. **Reload workspace:**
   - After updating the `.code-workspace` file, VS Code will prompt to reload
   - Or manually: `Ctrl+Shift+P` → "Workspaces: Reload Workspace"

## Important Reminders

- ✅ Always write Norwegian first, then English
- ✅ Follow Diátaxis framework strictly
- ✅ Use approved terminology from TERMINOLOGY.md
- ✅ Include practical examples and use cases
- ✅ Test documentation locally before PR
- ✅ Run PII check before committing
- ✅ Add new Git repos to the workspace file for proper Source Control management
- ❌ Never use placeholder data that looks like real personal information
- ❌ Never skip the English translation
- ❌ Never commit without reviewing WRITING-GUIDE.md

## Getting Help

When uncertain about:
- **Terminology**: Check TERMINOLOGY.md or ask user
- **Structure**: Look at similar existing documentation
- **Style**: Follow WRITING-GUIDE.md examples
- **Technical details**: Verify with source code when available
