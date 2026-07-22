---
type: process
title: PR-prosess — auto-merge på trygge stier, menneske-review på sensitive
description: Plattform-håndhevet skille mellom trygge endringer (reviewer-subagent + auto-merge) og sensitive endringer (CODEOWNERS krever menneskelig godkjenning). Én agent-identitet, ingen Contents-tilgang for agent-tokens.
timestamp: 2026-07-22T00:00:00Z
---

# PR-prosess: auto-merge på trygge stier

## Hvorfor

Agent-pipelinen skal kunne utbedre seg selv uten at hvert eneste
dokumentasjons- eller småfiks-PR venter på et menneske — men endringer som
styrer *agentenes egen oppførsel* eller *sikkerhetsmodellen* skal alltid ha
menneskelig godkjenning. Bakgrunn (issue #54): i PR #47 blokkerte
kodeagentens tillatelses-klassifiserer redigering av dens egen instruksfil —
riktig instinkt, men skillet bør håndheves av plattformen, ikke av den
enkelte agentens dømmekraft.

**Viktig premiss:** merge til deploy-branchen er auto-deploy innen minutter
([scripts/self-update.ps1](../scripts/self-update.ps1) med `-WatchSeconds`).
Auto-merge på trygge stier er dermed auto-deploy uten menneske i løkka —
helsesjekk + rollback fanger krasj, men ikke uønsket oppførsel. Listen over
sensitive stier er satt med det i mente.

## Mekanikken — én identitet, fire brikker

1. **[`.github/CODEOWNERS`](../.github/CODEOWNERS)** legger menneskelig eier
   på sensitive stier: agent-instrukser (`agents/*/CLAUDE.md`), skills,
   entrypoints, `integrations/src/`, Docker-filer, `scripts/` og `.github/`
   selv.
2. **Branch protection på deploy-branchen** (settes av repo-admin, se under):
   required approvals **0** + **Require review from Code Owners** + required
   status check (CI). Kombinasjonen gir nøyaktig skillet:
   - PR uten CODEOWNERS-treff → kan merges uten noen godkjenning.
   - PR som rører en sensitiv sti → blokkert til code owner har godkjent.
3. **CI som required check**
   ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml), minimal:
   typecheck i `integrations/`) — «grønn CI før merge» er plattform-håndhevet,
   ikke konvensjon.
4. **Auto-merge via GitHub Action**
   ([`.github/workflows/auto-merge.yml`](../.github/workflows/auto-merge.yml)):
   når en PR får labelen `auto-merge`, slår workflowen på GitHubs native
   auto-merge med den efemere `GITHUB_TOKEN`. Merging krever Contents write —
   det har bare workflowen, aldri agent-tokenene. Labelen kan ikke omgå
   branch protection: rører PR-en en sensitiv sti, venter mergen på code
   owner uansett.

## Prosessen for agentene

Før en agent setter `auto-merge`-labelen på sin egen PR skal den:

1. Kjøre en **reviewer-subagent** på diffen (ferske øyne, ikke samme
   kontekst som skrev koden).
2. Poste reviewens funn og konklusjon som **kommentar på PR-en** — det er
   audit-sporet for at review faktisk er gjort.
3. Først da sette labelen: `gh pr edit <nr> --add-label auto-merge`.

Rører PR-en en sensitiv sti er labelen virkningsløs (og bør utelates) —
pek i stedet på PR-en i svaret til brukeren, som før: mennesket er
review-gaten.

## Oppsett (repo-admin, gjøres i GitHub UI/API)

Dette kan ikke leveres som filer i repoet:

1. **Branch protection / ruleset på `v2.0`** (og senere `main`):
   - Require a pull request before merging, **required approvals: 0**
   - **Require review from Code Owners: enabled**
   - Required status checks: **`integrations`** (jobben i CI-workflowen)
2. **Repo-innstilling:** «Allow auto-merge» må være slått på (kreves av
   `gh pr merge --auto`).
3. **Label:** opprett `auto-merge` i repoet
   (`gh label create auto-merge --repo digdir/digdir-ai-agents`).

## Grenser og videre

- `integrations/src/` er sensitiv i sin helhet i første omgang, siden CI kun
  er typecheck; kan snevres til `config.ts` når testdekning finnes.
- Merges gjort av `GITHUB_TOKEN` trigger ikke andre workflows — irrelevant
  her, siden deploy er polling-basert (self-update-watcheren), ikke en
  Action.
