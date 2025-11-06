# GitHub Copilot Quick Start Test

## 5-Minute Verification Test

### Step 1: Verify Copilot is Active
1. Open VS Code in this directory: `workflows/documentation/`
2. Check status bar - should see Copilot icon (bottom right)
3. Open Copilot Chat: `Ctrl+Shift+I` (Windows) or `Cmd+Shift+I` (Mac)

### Step 2: Test Basic Awareness
**In Copilot Chat, type:**
```
What documentation guidelines should I follow in this project?
```

**Expected Response:**
Copilot should mention:
- CLAUDE.md
- WRITING-GUIDE.md
- TERMINOLOGY.md
- Writing Norwegian first
- Diátaxis framework

**✅ If yes** → Continue to Step 3
**❌ If no** → See troubleshooting below

---

### Step 3: Test Terminology Knowledge
**In Copilot Chat, type:**
```
Check TERMINOLOGY.md - what's the approved Norwegian translation for "authentication"?
```

**Expected Response:**
Should reference TERMINOLOGY.md and provide the approved term.

**✅ If yes** → Continue to Step 4
**❌ If no** → Copilot may not be reading project files

---

### Step 4: Test Documentation Generation
**In Copilot Chat, type:**
```
Create a simple documentation template for explaining SMS character limits.
Use Norwegian (bokmål), include front matter, and follow our Diátaxis "explanation" format.
```

**Expected Response:**
Should create markdown with:
- YAML front matter (title, description, etc.)
- Norwegian language content
- Clear section structure (Introduksjon, how it works, limitations, etc.)
- Hugo shortcodes for warnings/info

**✅ If yes** → Copilot is working well!
**❌ If no** → May need more explicit prompts

---

### Step 5: Test Issue Understanding
**In Copilot Chat, type:**
```
I want to document GitHub issue Altinn/altinn-notifications#1098.
What are the key steps in our workflow?
```

**Expected Response:**
Should outline:
1. Fetch issue with gh CLI
2. Analyze requirements
3. Explore existing docs
4. Write Norwegian, then English
5. Run PII check
6. Create PR

**✅ If yes** → Excellent! Ready for real work
**❌ If no** → Copilot may need more context

---

## Troubleshooting

### Copilot doesn't mention project guidelines
**Try:**
1. Reload VS Code window (Ctrl+Shift+P → "Reload Window")
2. Make sure you're in `workflows/documentation/` directory
3. Ask explicitly: "Read .github/copilot-instructions.md and summarize"

### Copilot gives generic answers
**Try:**
1. Open WRITING-GUIDE.md in VS Code
2. Then ask your question
3. Be more specific: "According to WRITING-GUIDE.md in this project..."

### Copilot seems unaware of files
**Check:**
1. Files exist in correct locations:
   - `../../.github/copilot-instructions.md`
   - `./WRITING-GUIDE.md`
   - `./TERMINOLOGY.md`
   - `./CLAUDE.md`
2. Try `@workspace` prefix in Copilot Chat

---

## Quick Reference: Common Copilot Prompts

### Analyze an Issue
```
Analyze GitHub issue [org]/[repo]#[number] and suggest documentation structure
```

### Generate Documentation
```
Create [explanation/guide/tutorial] documentation about [topic] in Norwegian (bokmål).
Follow WRITING-GUIDE.md and use approved terms from TERMINOLOGY.md.
```

### Review Content
```
Review this documentation for compliance with our WRITING-GUIDE.md:
[paste content]
```

### Translate
```
Translate this Norwegian documentation to English.
Use TERMINOLOGY.md for technical terms:
[paste Norwegian content]
```

### Check Terminology
```
What does TERMINOLOGY.md say about translating "[term]"?
```

---

## Compare with Claude Code

If you've used Claude Code for documentation:
1. Pick a completed documentation task
2. Ask Copilot to create similar documentation
3. Compare:
   - Terminology accuracy
   - Style compliance
   - Structure quality
   - Completeness

**Take notes on differences to improve instructions!**

---

## Next Steps

### ✅ If Quick Tests Pass:
→ Go to **COPILOT-TEST-PLAN.md** for comprehensive testing

### ❌ If Tests Fail:
1. Check Copilot extension is installed and active
2. Verify `.github/copilot-instructions.md` exists
3. Reload VS Code
4. Try explicit file references in prompts
5. Update copilot-instructions.md if needed

---

## Real-World Test

**Ready for a real test?** Try this:

1. Find a small documentation issue on GitHub (or use #1098 if still relevant)
2. Ask Copilot to help you through the entire workflow
3. Follow its guidance but verify against WRITING-GUIDE.md
4. Generate draft documentation
5. Compare quality with your expectations
6. Note what worked and what needs improvement

**Document your findings** to improve the instructions!
