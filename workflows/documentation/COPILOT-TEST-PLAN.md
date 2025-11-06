# GitHub Copilot Testing Plan

## Purpose
Test if GitHub Copilot can use the project's documentation guides to create quality documentation from GitHub issues.

## Prerequisites

### 1. Ensure GitHub Copilot is Installed
- VS Code: Install "GitHub Copilot" and "GitHub Copilot Chat" extensions
- CLI: Install with `gh extension install github/gh-copilot`

### 2. Verify Copilot Can Access Instructions
GitHub Copilot automatically reads `.github/copilot-instructions.md` in the repository root.

**Test it:**
```bash
# In VS Code, open Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
# Ask: "What are the documentation guidelines for this project?"
# Expected: Copilot should reference CLAUDE.md, WRITING-GUIDE.md, TERMINOLOGY.md
```

## Test Cases

### Test Case 1: Simple Documentation Request
**Objective:** Verify Copilot understands basic workflow

**Steps:**
1. Navigate to `workflows/documentation/` directory
2. Open GitHub Copilot Chat
3. Enter prompt:
   ```
   I need to create documentation for GitHub issue Altinn/altinn-notifications#1098.
   Please outline the steps I should follow according to our documentation workflow.
   ```

**Expected Result:**
Copilot should mention:
- Fetching issue with `gh issue view`
- Checking WRITING-GUIDE.md and TERMINOLOGY.md
- Writing Norwegian first, then English
- Using Diátaxis framework
- Running PII check
- Creating PR

**Pass Criteria:** ✅ Mentions at least 4 of the above steps

---

### Test Case 2: Terminology Compliance
**Objective:** Verify Copilot uses approved terminology

**Steps:**
1. Open Copilot Chat in `workflows/documentation/`
2. Ask:
   ```
   I'm writing documentation about SMS messages being split into multiple parts.
   What Norwegian term should I use for "segmentation"?
   ```

**Expected Result:**
- Should reference TERMINOLOGY.md
- Should suggest "segmentering" (if that's in your TERMINOLOGY.md)
- Should mention checking the terminology file

**Pass Criteria:** ✅ References TERMINOLOGY.md or suggests correct approved term

---

### Test Case 3: Writing Style Guidance
**Objective:** Verify Copilot applies writing guidelines

**Steps:**
1. Open Copilot Chat
2. Ask:
   ```
   Review this documentation sentence and suggest improvements:
   "The SMS messages that exceed the maximum character limit will be
   automatically split by the system into multiple segments which will be
   sent separately and then reassembled on the recipient's device."
   ```

**Expected Result:**
- Should suggest shorter sentences (per WRITING-GUIDE.md)
- Should suggest active voice
- Should recommend clarity improvements

**Pass Criteria:** ✅ Suggests breaking into shorter sentences or improving clarity

---

### Test Case 4: Generate Documentation Structure
**Objective:** Test if Copilot can create proper documentation structure

**Steps:**
1. Create a test file: `workflows/documentation/repos/altinn-studio-docs/content/test/_index.nb.md`
2. Open Copilot Chat with this file open
3. Ask:
   ```
   Create documentation structure for explaining API rate limits.
   This should be an "explanation" type document in the Diátaxis framework.
   Include front matter and main sections.
   ```

**Expected Result:**
```markdown
---
title: API-hastighetsbegrensninger
description: "..."
linktitle: Hastighetsbegrensninger
tags: [api, rate-limit]
weight: XX
---

## Introduksjon
...

## Hvordan hastighetsbegrensning fungerer
...

## Begrensninger
...

## Anbefalinger
...
```

**Pass Criteria:**
- ✅ Includes proper front matter
- ✅ Uses Norwegian language
- ✅ Has clear section structure
- ✅ Follows explanation format (conceptual, not step-by-step)

---

### Test Case 5: End-to-End Issue Documentation
**Objective:** Full workflow test - create documentation from scratch

**Test Issue:** Pick a simple, real issue from Altinn repos (or create a test issue)

**Steps:**
1. Open Copilot Chat in `workflows/documentation/` directory
2. Enter comprehensive prompt:
   ```
   I need to document GitHub issue Altinn/altinn-notifications#[NUMBER].

   Please:
   1. Help me analyze what documentation is needed
   2. Determine the correct location in altinn-studio-docs
   3. Create the Norwegian documentation following our WRITING-GUIDE.md
   4. Create the English translation
   5. Suggest what to check before creating a PR

   Follow our documentation workflow guidelines.
   ```

**Expected Result:**
Copilot should provide:
1. Analysis of the issue requirements
2. Suggested file path
3. Norwegian markdown content with proper structure
4. English translation
5. Testing checklist (Hugo, PII check, etc.)

**Pass Criteria:**
- ✅ Proper Diátaxis classification
- ✅ Norwegian content is written first
- ✅ Uses approved terminology (if applicable)
- ✅ Includes Hugo shortcodes for warnings/info
- ✅ Front matter is correct
- ✅ Mentions PII check and Hugo testing

---

### Test Case 6: Code Generation with Context
**Objective:** Verify Copilot can generate XACML examples following authorization guidelines

**Steps:**
1. Navigate to authorization docs area
2. Open Copilot Chat
3. Ask:
   ```
   Generate an XACML rule that allows users with role "REGNA" to read
   instances in Task_1. Follow the pattern from our rule library.
   ```

**Expected Result:**
- Should generate valid XACML XML
- Should follow the pattern from rules/_index.nb.md
- Should include proper attributes (urn:altinn:rolecode, etc.)

**Pass Criteria:** ✅ Generated XACML matches the structure in rules library

---

### Test Case 7: Terminology Translation
**Objective:** Test terminology lookup during translation

**Steps:**
1. Create a test Norwegian paragraph with technical terms
2. Ask Copilot:
   ```
   Translate this to English using our approved TERMINOLOGY.md:

   "SMS-segmentering deler automatisk opp lange meldinger i flere segmenter."
   ```

**Expected Result:**
- Should translate using approved English terms from TERMINOLOGY.md
- Should maintain technical accuracy
- Should follow English writing style

**Pass Criteria:** ✅ Uses approved terminology and maintains meaning

---

## Scoring System

For each test case:
- **Pass (2 points)**: Meets all pass criteria
- **Partial (1 point)**: Meets some criteria but needs improvement
- **Fail (0 points)**: Doesn't meet criteria or produces incorrect output

**Total Possible Score:** 14 points

**Interpretation:**
- **12-14 points**: Copilot is ready for production use with minimal supervision
- **8-11 points**: Copilot provides good assistance but requires review
- **4-7 points**: Copilot understands basics but needs significant guidance
- **0-3 points**: Copilot may not be reading instructions properly

## Troubleshooting

### Issue: Copilot doesn't seem to use the instructions
**Solutions:**
1. Verify `.github/copilot-instructions.md` exists in repo root
2. Try reloading VS Code window
3. Check Copilot is active (green icon in status bar)
4. Try explicitly mentioning: "According to our copilot-instructions.md..."

### Issue: Copilot gives generic answers
**Solutions:**
1. Be more specific in prompts
2. Reference specific files: "Check WRITING-GUIDE.md and tell me..."
3. Open relevant files in VS Code before asking
4. Use workspace mode in Copilot Chat

### Issue: Copilot suggests wrong terminology
**Solutions:**
1. Ensure TERMINOLOGY.md is in `workflows/documentation/` directory
2. Explicitly ask: "What does TERMINOLOGY.md say about [term]?"
3. Reference the file in your prompt

## Advanced Testing

### Test with Real Issues
Once basic tests pass, try with actual Altinn issues:

1. **Pick a documentation issue** from Altinn repos
2. **Use Copilot to draft** the documentation
3. **Compare with what Claude Code would produce**
4. **Assess quality:**
   - Does it follow guidelines?
   - Is terminology correct?
   - Is structure appropriate?
   - Would it need significant editing?

### Iterate on Instructions
Based on test results, update `.github/copilot-instructions.md` to:
- Add missing guidelines
- Clarify confusing points
- Add more examples
- Reference additional files

## Documentation Quality Checklist

Use this to evaluate Copilot-generated documentation:

**Structure:**
- [ ] Has proper front matter (title, description, linktitle, weight)
- [ ] Follows Diátaxis framework (correct type)
- [ ] Has logical section flow
- [ ] Uses appropriate heading levels

**Content:**
- [ ] Norwegian written before English (if applicable)
- [ ] Uses approved terminology from TERMINOLOGY.md
- [ ] Follows WRITING-GUIDE.md style (short sentences, active voice)
- [ ] Includes practical examples
- [ ] Has appropriate warnings/info boxes

**Technical:**
- [ ] Code examples are correct
- [ ] Hugo shortcodes are properly formatted
- [ ] File naming convention is correct (_index.nb.md / _index.en.md)
- [ ] No PII or sensitive data

**Completeness:**
- [ ] Addresses all issue acceptance criteria
- [ ] Includes "how it works" explanation
- [ ] Provides limitations and recommendations
- [ ] Links to related documentation

## Next Steps After Testing

### If tests pass well (10+ points):
1. Start using Copilot for documentation tasks
2. Review and edit Copilot suggestions before committing
3. Continue monitoring quality
4. Update instructions based on learnings

### If tests are mixed (5-9 points):
1. Review which test cases failed
2. Update `.github/copilot-instructions.md` with more guidance
3. Add more examples to guidelines
4. Re-test specific failing scenarios

### If tests fail (< 5 points):
1. Verify Copilot is reading the instructions (check with explicit question)
2. Consider if instructions are too complex or unclear
3. Try simplifying instructions
4. Check if other context files (CLAUDE.md, etc.) are accessible

## Reporting Results

Document your test results:

```markdown
# Copilot Test Results - [Date]

## Test Scores
- Test Case 1: [Pass/Partial/Fail] - [Notes]
- Test Case 2: [Pass/Partial/Fail] - [Notes]
...

## Total Score: X/14

## Observations
- What worked well:
- What needs improvement:
- Unexpected behaviors:

## Recommendations
- Updates to copilot-instructions.md:
- Additional training/examples needed:
- Workflow changes:
```

## Continuous Improvement

After successful deployment:
1. **Collect feedback** from team using Copilot
2. **Track common issues** or mistakes
3. **Update instructions** monthly based on learnings
4. **Compare quality** with Claude Code outputs
5. **Share best prompts** that work well with your setup
