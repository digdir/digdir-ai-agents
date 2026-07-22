# local-cc-jr-developer — junior utførende kodeagent (Claude Code + lokal modell)

Junior-utgaven av den utførende kodeagenten: samme runtime (Claude Code CLI,
interaktivt) og samme filkontrakt som
[`local-cc-coding-agent`](../local-cc-coding-agent/), men modellen er en
**lokal kodemodell** servert av LM Studio via dets Anthropic-kompatible
`/v1/messages`-API. Ingen proxy eller oversettelseslag — bare env-variabler
som peker CLI-en på det lokale endepunktet.

Oppstart er én kommando (skriptet setter env og starter CLI-en fra denne
katalogen):

```powershell
.\scripts\junior-agent.ps1
# > lytt på innboksen
```

Instruksene ligger i [CLAUDE.md](CLAUDE.md) og lastes automatisk når sesjonen
starter her. Viktigste forskjell fra senior-agenten: junior-agenten skal ta
**godt definerte, avgrensede, lav-risiko** oppgaver — og er eksplisitt
instruert til å melde tilbake i stedet for å gjette når en oppgave er uklar
eller større enn antatt.

Oppgaver delegeres hit av andre agenter (proxy-agenten med `DELEGATE_AGENTS`)
via broen — integrations må ha `local-cc-jr-developer` i `AGENT_ROUTES`.
Kontrakten er den samme som for alle agenter: `triggers/inbox.jsonl` inn,
`triggers/results.jsonl` + `triggers/logs/<id>.log` ut. Svar postes automatisk
tilbake i den opprinnelige Slack-tråden / GitHub-issuet.

## Krav til LM Studio

- LM Studio kjører på hosten og serverer på `http://127.0.0.1:1234`.
- Modellen `ornith-1.0-35b-nvfp4-mtp` er lastet, med **romslig
  kontekstvindu** — Claude Code er kontekst-tungt, så minst 25k tokens,
  helst mer.

Arbeidsklonene ligger i den gitignorerte anker-folderen
`workspaces_repos/<provider>/<org>/<repo>` på monorepo-rot; leveransen er
alltid branch + PR med et menneske som review-gate.
