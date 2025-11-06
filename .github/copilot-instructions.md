# GitHub Copilot Instructions for Documentation Workflows

## Overview
This repository contains AI-assisted documentation workflows for creating high-quality Norwegian and English technical documentation, primarily for Altinn projects.

## Documentation Guidelines

### Primary Reference Files
When working on documentation tasks, **always** refer to these files:

1. **`workflows/documentation/CLAUDE.md`** - Main workflow instructions and agent usage
2. **`workflows/documentation/WRITING-GUIDE.md`** - Writing style and quality guidelines
3. **`workflows/documentation/TERMINOLOGY.md`** - Approved terminology and translations
4. **`workflows/documentation/.github/agents/technical-writer.md`** - Technical writing standards and practices
5. **`workflows/documentation/.github/agents/language-editor-nb.md`** - Norwegian (Bokmål) language guidelines and Klarspråk principles
6. **`workflows/documentation/.github/agents/language-editor-en.md`** - English language guidelines and plain language principles

### CRITICAL: Read Agent Guidelines Before Writing

**BEFORE creating any documentation, you MUST:**
1. Read the relevant language-editor file (nb.md for Norwegian, en.md for English)
2. Read technical-writer.md for overall documentation standards
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

### Documentation Principles

#### Language Requirements
- **Always write Norwegian (bokmål) first, then English**
- Use conservative Norwegian bokmål forms
- Follow approved translations from TERMINOLOGY.md
- Both versions must have identical structure and front matter

#### Diátaxis Framework
All documentation must follow the Diátaxis model:
- **Tutorial (Innføring)**: Learning-focused, step-by-step guides
- **How-to Guide (Veiledning)**: Task-focused, problem-solving instructions
- **Explanation (Forklaring)**: Understanding-focused, conceptual content
- **Reference (Referanse)**: Information-focused, technical specifications

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

### Working with GitHub Issues

When asked to create documentation for a GitHub issue:

1. **Fetch the issue**: Use `gh issue view [number] --repo [repo]`
2. **Analyze requirements**: Identify what documentation is needed from acceptance criteria
3. **Explore existing docs**: Check where similar documentation exists
4. **Create structured content**:
   - Introduction explaining the concept
   - Clear technical details with examples
   - Practical guidance and recommendations
   - Warning/info boxes for important notes
5. **Translate to English**: Maintain identical structure
6. **Run PII check**: Verify no sensitive data using `python utils/pii-check/pii-check.py`

### Quality Standards

#### Writing Style
- **Clear and concise**: Short sentences, active voice
- **User-focused**: Write for the reader's context
- **Practical examples**: Include real-world scenarios
- **Consistent terminology**: Use approved terms from TERMINOLOGY.md

#### Hugo Shortcodes
Use these for callouts:
```markdown
{{% notice info %}}
Information message
{{% /notice %}}

{{% notice warning %}}
Warning message
{{% /notice %}}
```

#### Code Examples
- Use appropriate syntax highlighting
- Include context comments
- Show both correct and incorrect usage when helpful

### Repository Structure

#### altinn-studio-docs
Main documentation repository structure:
- `/content/notifications/` - Notifications service docs
- `/content/authorization/` - Authorization docs
- `/content/altinn-studio/` - Altinn Studio docs

Documentation is organized by:
- **about/** - Product information
- **getting-started/** - Initial setup guides
- **guides/** - How-to guides (Diátaxis: how-to-guides)
- **explanation/** - Conceptual documentation (Diátaxis: explanation)
- **reference/** - Technical reference (Diátaxis: reference)

### Testing Documentation

Before creating a PR:
1. Run Hugo locally: `hugo server --navigateToChanged`
2. Preview at http://localhost:1313/
3. Verify both language versions
4. Check all links work
5. Verify shortcodes render correctly
6. Run PII check

### Common Patterns

#### SMS/Email Notifications
- Explain technical limits clearly
- Include character count tables
- Warn about automatic truncation
- Provide recommendations

#### Authorization/Authentication
- Distinguish authentication (who) from authorization (what they can do)
- Include complete XACML examples
- Show end-to-end workflows
- Provide testing guidance

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
# Start local server
cd repos/altinn-studio-docs
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
# 1. Fetch GitHub issue
gh issue view 1098 --repo Altinn/altinn-notifications

# 2. Clone documentation repo (if needed)
cd workflows/documentation/repos
gh repo clone Altinn/altinn-studio-docs

# 3. Explore existing structure
cd altinn-studio-docs
find content -name "*.nb.md" | grep [topic]

# 4. Create branch
git checkout -b docs/new-feature

# 5. Write documentation (following WRITING-GUIDE.md and TERMINOLOGY.md)

# 6. Test with Hugo
hugo server --navigateToChanged

# 7. Run PII check
cd ../../..
python utils/pii-check/pii-check.py --root-folder repos/altinn-studio-docs/content/[path]

# 8. Commit and create PR
cd repos/altinn-studio-docs
git add .
git commit -m "Add documentation for [feature]"
git push -u origin docs/new-feature
gh pr create --title "Add documentation for [feature]" --body "..."
```

## Important Reminders

- ✅ Always write Norwegian first, then English
- ✅ Follow Diátaxis framework strictly
- ✅ Use approved terminology from TERMINOLOGY.md
- ✅ Include practical examples and use cases
- ✅ Test documentation locally before PR
- ✅ Run PII check before committing
- ❌ Never use placeholder data that looks like real personal information
- ❌ Never skip the English translation
- ❌ Never commit without reviewing WRITING-GUIDE.md

## Getting Help

When uncertain about:
- **Terminology**: Check TERMINOLOGY.md or ask user
- **Structure**: Look at similar existing documentation
- **Style**: Follow WRITING-GUIDE.md examples
- **Technical details**: Verify with source code when available
