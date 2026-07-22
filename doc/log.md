---
type: log
title: Endringslogg for doc/
description: Append-only kronologi over endringer i repoets kunnskapsbase. Nyeste øverst.
---

# Logg

- **2026-07-22** — PR-prosess (issue #54): plattform-håndhevet skille mellom
  trygge og sensitive endringer. `.github/CODEOWNERS` legger menneskelig
  eier på agent-instrukser, skills, entrypoints, `integrations/src/`,
  Docker-filer, `scripts/` og `.github/`; sammen med branch protection
  (approvals 0 + Require review from Code Owners + required check) kan
  trygge PR-er auto-merges: agenten kjører reviewer-subagent, poster
  reviewen som PR-kommentar og setter labelen `auto-merge` — en workflow
  merger med efemer `GITHUB_TOKEN` (agent-tokens har fortsatt ingen
  Contents-tilgang). Minimal CI (`ci.yml`, typecheck i integrations) som
  required check. Se [pr-prosess.md](pr-prosess.md).

- **2026-07-22** — Fiks: PR #55 glemte volumlinja for junior-agentens
  `triggers/` i `integrations/docker-compose.yml`, så integrations krasjet
  ved oppstart med `EACCES: mkdir /agents/local-cc-jr-developer` (køen
  prøvde å opprette rutekatalogen i containerens rot-eide `/agents`).
  Én mount-linje per rute i `AGENT_ROUTES` er kontrakten — nå dokumentert
  av feilen også.

- **2026-07-22** — Junior-kodeagent (issue #53): ny agent
  `local-cc-jr-developer` — Claude Code CLI mot lokal modell via LM Studios
  Anthropic-kompatible API (`scripts/junior-agent.ps1` setter env og starter
  CLI-en). Samme filkontrakt og protokoll som local-cc-coding-agent, med
  eksplisitt «meld tilbake i stedet for å gjette»-instruks.
  Solution-proposal-skillen fikk valgkriterier junior vs senior (godt
  definert/avgrenset/lav risiko → junior; komplekst/uklart/arkitektur/
  sikkerhet → senior), og ruting/konfig-eksempler (`AGENT_ROUTES`,
  `DELEGATE_AGENTS`) er oppdatert.

- **2026-07-22** — Drift: restart-policy gjort overstyrbar
  (`RESTART_POLICY`, default `unless-stopped`) med `scripts/dev.ps1` for
  utvikling i forgrunnen, og `scripts/self-update.ps1` for selvoppgradering
  «i fart» fra hosten — bygger nye images før den kjørende klyngen røres,
  helsesjekker etter bytte og ruller tilbake til `:rollback`-imagene ved
  feil. Utløser: merge til deploy-branchen.

- **2026-07-21** — Læringsløkke for delegering (issue #43): broen sender et
  `delegation-outcome`-event til opphavsagenten når det delegerte svaret er
  levert (`AGENT_DELEGATION_DEBRIEF`, default på; ingen svar-rute, teller
  ikke som hopp). Proxy-agenten reflekterer ved debrief og skriver
  prosess-læringer (`scope: "process"`, `source: "agent"`) til
  kunnskapsrepoets innboks; kodeagenten fikk et retro-steg som avleverer
  tilsvarende læringer før resultatlinja.

- **2026-07-21** — Prosess-hygiene i delegeringsflyten (issue #41):
  proxy-agenten eier issues ende-til-ende — solution-proposal-skillen
  self-assigner opprettede issues og krever `Closes #<nr>` i kodeagentens
  PR-body; kodeagentens instruks presiserer Closes-kravet og at den aldri
  administrerer issues; GitHub-polleren unassigner seg ikke lenger —
  assignment fra et menneske er en arbeidsordre som legger issuen i
  agent-køen (samme håndtering som mention).

- **2026-07-21** — Fiks i integrations: GitHub-polleren deduperte på
  notifikasjonstrådens ID (stabil per issue), slik at all senere interaksjon
  med et allerede håndtert issue ble droppet stille i samme sesjon. Dedupérer
  nå på hendelses-ID-en fra `eventIdFor` (per kommentar / per oppdatering).

- **2026-07-21** — M3 i [plans/agent-delegering.md](plans/agent-delegering.md):
  ny skill `solution-proposal` i proxy-agenten — henvendelser som krever
  kodeendringer analyseres (read-only `/repos`), struktureres som
  GitHub-issue (bakgrunn, foreslått løsning, steg, berørte filer,
  akseptansekriterier) og delegeres til `local-cc-coding-agent` med
  issue-URL i payload og selvstendig prompt.

- **2026-07-21** — Delegering mellom agenter (M1+M2 i
  [plans/agent-delegering.md](plans/agent-delegering.md)): resultatlinjer med
  `intent: "delegate"` rutes av integrations til målagentens innboks
  (allowlist `AGENT_ROUTES`, hoppgrense, svar-kontekst remappes så endelig
  svar lander i opprinnelig tråd/issue). Ny agent `local-cc-coding-agent`
  (interaktiv Claude Code med CLAUDE.md-instruks) som utførende kodeagent;
  proxy-agenten fikk `DELEGATE_AGENTS` og read-only `/repos`.

- **2026-07-21** — M6 gjennomført: ny skill `web-research` — agenten leser
  nettsider med agent-browser (headless Chromium i imaget), arkiverer
  kilden som markdown-snapshot i KB-repoets `sources/` med proveniens
  (`resource` + `retrieved`; samme URL = samme fil, git-diff viser endringer
  på kilden), og destillerer lærdommer med `source_url`. Syntesen tar
  kildelenker med inn i wiki-sidene.
- **2026-07-21** — M4+M5 gjennomført: ny skill `knowledge-synthesis`
  integrerer innboks-kandidater i OKF-sidene (oppdaterer index/log, flagger
  motsigelser, tømmer innboksen, pusher), og watch-loopen kjører syntesen
  automatisk når innboksen har kandidater og `SYNTHESIS_INTERVAL_HOURS` er
  passert. Verifisert live: agenten opprettet `domains/digdir-ai.md` fra en
  ekte læringskandidat og pushet selv.
- **2026-07-21** — M3 gjennomført: agenten fanger læringer — appender
  kandidater til `inbox/learnings.jsonl` i kunnskapsrepoet og
  committer/pusher selv med bot-identitet (entrypointet konfigurerer
  identitet og retry-pusher ved oppstart). Repo-spesifikke læringer meldes
  i tillegg som issue med label `learning`.
- **2026-07-21** — M2 gjennomført: proxy-agenten kloner/puller
  kunnskapsrepoet (`KB_REPO`/`KB_GH_TOKEN`) til `/knowledge` via
  anker-folderen `workspaces_knowledge/`, ny skill `knowledge-base`,
  kunnskaps-hint i prompten. Kunnskapsrepoet bootstrappet med
  OKF-grunnstruktur.
- **2026-07-21** — Opprettet `doc/` med OKF-konvensjoner; la inn plan for
  kunnskaps- og læringsprosessen ([plans/kunnskap-og-laering.md](plans/kunnskap-og-laering.md)).
