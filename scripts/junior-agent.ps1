<#
.SYNOPSIS
  Starter junior-kodeagenten: Claude Code CLI mot lokal modell via LM Studios
  Anthropic-kompatible API.

.DESCRIPTION
  Setter env-variablene som peker Claude Code på LM Studio-endepunktet på
  hosten, og starter CLI-en fra agents/local-cc-jr-developer/ slik at
  agentens CLAUDE.md lastes som instruks. Forutsetter at LM Studio kjører på
  127.0.0.1:1234 med modellen lastet (romslig kontekstvindu — minst 25k
  tokens, helst mer; Claude Code er kontekst-tungt).

  Env-variablene settes bare for denne prosessen. Alle ekstra argumenter
  sendes videre til `claude` (f.eks. `.\scripts\junior-agent.ps1 --resume`).
#>
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:1234"
$env:ANTHROPIC_AUTH_TOKEN = "lmstudio"
$env:ANTHROPIC_MODEL = "ornith-1.0-35b-nvfp4-mtp"

Push-Location (Join-Path (Split-Path $PSScriptRoot -Parent) "agents\local-cc-jr-developer")
try {
  claude @args
} finally {
  Pop-Location
}
