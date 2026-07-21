# local-cc-coding-agent — utførende kodeagent (Claude Code, interaktiv)

Den enkleste utgaven av en utførende kodeagent i pipelinen: du kjører Claude
Code **interaktivt** fra denne katalogen. Instruksene ligger i
[CLAUDE.md](CLAUDE.md) og lastes automatisk når sesjonen starter her.

```powershell
cd agents\local-cc-coding-agent
claude
# > lytt på innboksen
```

Oppgaver delegeres hit av andre agenter (f.eks. proxy-agenten med
`DELEGATE_AGENTS`) via broen — integrations må ha `AGENT_ROUTES=local-cc-coding-agent`.
Kontrakten er den samme som for alle agenter: `triggers/inbox.jsonl` inn,
`triggers/results.jsonl` + `triggers/logs/<id>.log` ut. Svar postes automatisk
tilbake i den opprinnelige Slack-tråden / GitHub-issuet.

Arbeidsklonene ligger i den gitignorerte anker-folderen
`workspaces_repos/<provider>/<org>/<repo>` på monorepo-rot; leveransen er
alltid branch + PR med et menneske som review-gate. Senere kan denne agenten
byttes ut med en containerisert kodeagent uten at noe annet i pipelinen
endres — kontrakten er identisk.
