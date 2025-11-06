# Documentation Workflow

The workflow `documentation` is intended as a root folder tailored to writing/translating/improving
"prose"-form documentation (i.e. not inline comments in code).

## AI Agent Support

This workflow supports both **Claude Code** and **GitHub Copilot** with specialized documentation agents:

### For Claude Code Users
- Configuration: `.claude/agents/`
- Usage guide: [CLAUDE.md](CLAUDE.md)
- Agents: `technical-writer`, `copywriter-norsk`, `copywriter-english`

### For GitHub Copilot Users
- Configuration: `.github/agents/`
- Usage guide: [.github/COPILOT.md](.github/COPILOT.md)
- Agents: `@technical-writer`, `@language-editor-nb`, `@language-editor-en`

Both configurations share the same reference files (TERMINOLOGY.md, WRITING-GUIDE.md) to ensure consistency.

## Directory Structure

`repos` is a folder added to .gitignore, that can serve as a container for other repos
(e.g. if the user documentation resides in one repo, and various products in individual/other repos, as is the case for Altinn)

`utils` contains helper-scripts (the plan is that these can work in conjunction with the agent e.g. hooking into
tooling and giving feedback at critical points in the workflow)

## Getting Started

**With Claude Code:**
```bash
cd workflows/documentation
claude
# See CLAUDE.md for instructions
```

**With GitHub Copilot:**
```bash
cd workflows/documentation
# Open in VS Code or use gh copilot chat
# See .github/COPILOT.md for instructions
```
