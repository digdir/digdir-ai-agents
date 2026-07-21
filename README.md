# digdir-ai-agents

Monorepo for en event-drevet agent-pipeline: én **integrations**-app som lytter
på Slack/GitHub, og et voksende sett **agenter** som utfører arbeidet isolert i
Docker — uten at agentene noensinne ser Slack-/GitHub-tokens.

```
Slack / GitHub
      │  (Socket Mode / notifications-polling — ingen inngående webhooks)
┌─────▼─────────┐
│ integrations/ │  eneste komponent med Slack-/GitHub-tokens
└─────┬─────────┘
      │ append                                      ┌──────────────────────┐
      ├──────────> agents/proxy-agent/triggers/ <───┤ agents/proxy-agent/  │
      │            inbox.jsonl                      │ (Pi i Docker)        │
      │ poll                                        └──────────────────────┘
      └──────────< triggers/results.jsonl + logs/<id>.log
```

## Komponenter

| Katalog | Rolle |
|---|---|
| [`integrations/`](integrations/) | Lytter på GitHub (notifications-polling) og Slack (Socket Mode), oversetter events til JSON-linjer i en agents `triggers/inbox.jsonl`, og poster svar fra `results.jsonl` tilbake dit de kom fra. |
| [`agents/proxy-agent/`](agents/proxy-agent/) | Pi-agent isolert i Docker. Poller sin egen `triggers/inbox.jsonl`, kjører agenten per event og skriver svar til `triggers/results.jsonl`. |

Kontrakten mellom integrations og agent er bevisst minimal: **to jsonl-filer i
agentens `triggers/`-katalog**. Formatet er beskrevet i
[`agents/proxy-agent/README.md`](agents/proxy-agent/README.md) (eventformat) og
[`integrations/README.md`](integrations/README.md) (resultatkontrakt med
`intent`/`reply`).

## Kom i gang

Hele pipelinen kjører i Docker via compose-fila på rotnivå (krever Docker
Compose v2.20+):

```powershell
# 1. Konfig per komponent
Copy-Item integrations\.env.example integrations\.env              # Slack-/GitHub-tokens
Copy-Item agents\proxy-agent\.env.example agents\proxy-agent\.env  # LLM-endepunkt/nøkkel

# 2. Dra opp alt
docker compose up -d --build
docker compose logs -f
```

Rot-compose-fila bare inkluderer komponentenes egne compose-filer, så hver
komponent kan fortsatt dras opp alene med `docker compose up` i sin katalog.
Integrations kan også kjøres rett på hosten under utvikling (Node >= 23:
`cd integrations && npm install && npm start`).

## Legge til en ny agent

Pipelinen utvides ved å legge nye agenter under `agents/<navn>/`. En agent er
hva som helst som oppfyller kø-kontrakten:

1. **Opprett `agents/<navn>/`** med en `triggers/`-katalog. Kopier gjerne
   `agents/proxy-agent/` som mal (Dockerfile + entrypoint som poller køen), men
   runtime er valgfri — det eneste kravet er filkontrakten.
2. **Les events** fra `triggers/inbox.jsonl` (én JSON-linje per event, feltet
   `prompt` er det viktigste; husk å persistere lest posisjon slik at restart
   ikke reprosesserer gamle events).
3. **Skriv resultater** til `triggers/results.jsonl` med samme `id`, og gjerne
   `intent` (`action` / `feedback` / `ack`) + `reply` slik at integrations vet
   hvordan svaret skal leveres. Full logg per event legges i
   `triggers/logs/<id>.log`.
4. **Pek integrations på agenten** via `AGENT_TRIGGERS_DIR` i
   `integrations/.env` (f.eks. `../agents/<navn>/triggers`).

Agentene holdes uavhengige av hverandre: hver agent eier sin egen
`triggers/`-katalog, sitt eget image og sin egen `.env`. Ruting av events til
flere agenter samtidig (f.eks. per kilde eller intent) er et naturlig neste
steg i integrations.

## Dokumentasjon og kunnskap

Repo-spesifikke læringspunkter og dokumentasjon ligger i [`doc/`](doc/)
(OKF-konvensjoner: markdown + frontmatter, `index.md` som inngangsport).
Overordnet kunnskap på tvers av repoer hører hjemme i agentens sentrale
kunnskapsbase: et privat, instans-spesifikt repo som klones til
anker-folderen `workspaces_knowledge/` (gitignorert) og mountes inn i
proxy-agenten som `/knowledge`. Se planen i
[`doc/plans/kunnskap-og-laering.md`](doc/plans/kunnskap-og-laering.md).

## Sikkerhetsmodell

- Bare `integrations/` har Slack-/GitHub-tokens; agentene ser kun jsonl-filene,
  sitt eget `workspace/` og sin egen kunnskapsbase. To bevisste, snevre unntak
  hos proxy-agent: `GH_TOKEN` (kun issues/PR-er, ingen kode-tilgang) for
  github-skillen, og `KB_GH_TOKEN` (Contents kun på det private
  kunnskapsrepoet) for kunnskapsbasen — se
  [`agents/proxy-agent/README.md`](agents/proxy-agent/README.md).
- Agent-containerne kjører som ikke-root med `cap_drop: ALL` og
  `no-new-privileges`, og trenger bare nettverk mot LLM-endepunktet.
- Ingen inngående webhooks: integrations bruker polling (GitHub) og websocket
  (Slack), så alt kan kjøre fra en laptop bak brannmur.
