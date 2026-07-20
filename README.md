# digdir-ai-agents

Monorepo for en event-drevet agent-pipeline: én **bot** som lytter på
Slack/GitHub, og et voksende sett **agenter** som utfører arbeidet isolert i
Docker — uten at agentene noensinne ser Slack-/GitHub-tokens.

```
Slack / GitHub
      │  (Socket Mode / notifications-polling — ingen inngående webhooks)
┌─────▼─────┐
│   bot/    │  eneste komponent med Slack-/GitHub-tokens
└─────┬─────┘
      │ append                                   ┌────────────────────┐
      ├──────────> agents/dd-agent/triggers/ <───┤ agents/dd-agent/   │
      │            inbox.jsonl                   │ (Pi i Docker)      │
      │ poll                                     └────────────────────┘
      └──────────< triggers/results.jsonl + logs/<id>.log
```

## Komponenter

| Katalog | Rolle |
|---|---|
| [`bot/`](bot/) | Lytter på GitHub (notifications-polling) og Slack (Socket Mode), oversetter events til JSON-linjer i en agents `triggers/inbox.jsonl`, og poster svar fra `results.jsonl` tilbake dit de kom fra. |
| [`agents/dd-agent/`](agents/dd-agent/) | Pi-agent isolert i Docker. Poller sin egen `triggers/inbox.jsonl`, kjører agenten per event og skriver svar til `triggers/results.jsonl`. |

Kontrakten mellom bot og agent er bevisst minimal: **to jsonl-filer i agentens
`triggers/`-katalog**. Formatet er beskrevet i
[`agents/dd-agent/README.md`](agents/dd-agent/README.md) (eventformat) og
[`bot/README.md`](bot/README.md) (resultatkontrakt med `intent`/`reply`).

## Kom i gang

```powershell
# 1. Agenten (Docker)
cd agents/dd-agent
Copy-Item .env.example .env      # fyll inn LLM-endepunkt/nøkkel
docker compose build
docker compose up -d

# 2. Boten (Node >= 23)
cd ../../bot
npm install
Copy-Item .env.example .env      # fyll inn Slack-/GitHub-tokens
# sett AGENT_QUEUE_ENABLED=true for å koble boten til agenten
npm start
```

## Legge til en ny agent

Pipelinen utvides ved å legge nye agenter under `agents/<navn>/`. En agent er
hva som helst som oppfyller kø-kontrakten:

1. **Opprett `agents/<navn>/`** med en `triggers/`-katalog. Kopier gjerne
   `agents/dd-agent/` som mal (Dockerfile + entrypoint som poller køen), men
   runtime er valgfri — det eneste kravet er filkontrakten.
2. **Les events** fra `triggers/inbox.jsonl` (én JSON-linje per event, feltet
   `prompt` er det viktigste; husk å persistere lest posisjon slik at restart
   ikke reprosesserer gamle events).
3. **Skriv resultater** til `triggers/results.jsonl` med samme `id`, og gjerne
   `intent` (`action` / `feedback` / `ack`) + `reply` slik at boten vet hvordan
   svaret skal leveres. Full logg per event legges i `triggers/logs/<id>.log`.
4. **Pek boten på agenten** via `AGENT_TRIGGERS_DIR` i `bot/.env`
   (f.eks. `../agents/<navn>/triggers`).

Agentene holdes uavhengige av hverandre: hver agent eier sin egen
`triggers/`-katalog, sitt eget image og sin egen `.env`. Ruting av events til
flere agenter samtidig (f.eks. per kilde eller intent) er et naturlig neste
steg i boten.

## Sikkerhetsmodell

- Bare `bot/` har Slack-/GitHub-tokens; agentene ser kun jsonl-filene og sitt
  eget `workspace/`.
- Agent-containerne kjører som ikke-root med `cap_drop: ALL` og
  `no-new-privileges`, og trenger bare nettverk mot LLM-endepunktet.
- Ingen inngående webhooks: boten bruker polling (GitHub) og websocket (Slack),
  så alt kan kjøre fra en laptop bak brannmur.
