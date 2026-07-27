---
type: log
title: Endringslogg for doc/
description: Append-only kronologi over endringer i repoets kunnskapsbase. Nyeste øverst.
---

# Logg

- **2026-07-27** — llm-gateway: Claude Code-agenter (jr-dev) kan kjøre mot
  Anthropic med subscription-OAuth uten at tokenet er inne i containeren —
  credential-non-possession-mønsteret fra nvt-agents mediated mode i
  miniatyr (jf. `doc/plans/nvt-agent-integrasjon.md`). Langlivet token fra
  `claude setup-token` bor kun i gatewayens `.env` (upstream `anthropic`);
  ny generisk `appendHeaders` per regel fletter `anthropic-beta:
  oauth-2025-04-20` inn i klientens beta-liste (appender, erstatter aldri —
  lærdom fra nvt). Agentens env: base-URL mot gatewayen + konsument-nøkkel.
  Foranledning: fjern LM Studio fortsatt utilgjengelig og Aivar mangler
  Anthropic-format — dette gir jr-dev backend igjen, med uendret
  GitHub-identitet og sandbox.

- **2026-07-27** — `apps/llm-gateway/`: lokal LLM-gateway som samler all
  modell-konfig på ett sted. Konsumenter (integrations-routeren,
  proxy-agenten) peker på ett endepunkt (`:8787/v1`) med en fake API-nøkkel
  som identifiserer konsumenten; gatewayen ruter per regel (path/modell) til
  riktig backend og legger på den ekte nøkkelen — routerens chat og
  embeddings kan dermed gå til hver sin backend over samme base-URL
  (routeren har fortsatt kun ett `ROUTER_BASE_URL`). Konsumentene bruker
  stabile modell-alias; backend-bytte er én endring i gatewayens
  `routes.json`. Null avhengigheter (Node ≥21), container-kjøring med
  publisering kun på `127.0.0.1`. Arvtakeren til den frittstående
  `llm-proxy-proxy`-en. Foranledning: fjern LM Studio-backend utilgjengelig
  — chat måtte via Aivar mens embeddings kjøres på lokal LM Studio.

- **2026-07-24** — Junior-agenten containerisert (issue #90): engangs-
  container per event i stedet for interaktiv CLI på hosten. Runner
  (`scripts/jr-runner.ps1`, erstatter `junior-agent.ps1`) poller innboksen
  og kjører `docker run --rm` per event — seriellt innen topic, parallelt
  på tvers. Workspace og Claude-sesjon per topic
  (`agents/local-cc-jr-developer/workspaces/<topic>/`, `CLAUDE_CONFIG_DIR`
  i workspacet, `--resume` på oppfølgingsevents). Eget fine-grained PAT for
  agenten (Contents+PR RW på arbeidsrepoene, kun i `.env`); monorepo,
  deploy-klone og `workspaces_repos/` mountes aldri inn. Entrypointet eier
  resultatlinja (svaret = agentens siste melding — ingen markør-parsing,
  jf. #83) og KB-læringssteget er tilpasset: commit i mountet `/knowledge`
  uten push; proxyen pusher ved neste sync.

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

- **2026-07-22** — Sikkerhet: hard allowlist for GitHub-initierte
  agent-aksjoner (issue #70): kun logins i `GITHUB_ALLOWED_USERS` kan utløse
  arbeidsordrer fra GitHub. Aktøren slås opp per notifikasjon før alt annet
  (assign → siste `assigned`-event; mention → forfatteren av innholdet som
  blir prompten). Ikke på lista: WARN-logg med aktør/repo/issue/reason, tråd
  markert lest, ingen reaksjon/kø/router-kall. Fail-closed: tom liste (med
  oppstartsadvarsel) eller feilet aktør-oppslag dropper eventet. Botens egne
  hendelser skippes fortsatt stille på debug-nivå (#63). Restrisiko
  (innholds-injection via godkjente brukere) dokumentert i
  integrations/README.

- **2026-07-22** — Læringsrunde etter dagens hendelser: agent-promptene er
  strammet opp mot fire observerte feilmønstre. (1) Proxyen forsøkte å kode
  selv på detaljerte issue-tekster (PR #73/#75) — entrypoint-prompten og
  solution-proposal sier nå eksplisitt at en komplett spesifikasjon er en
  bestilling å delegere. (2) Falske «jeg har fikset det»-kommentarer
  (#61/#63) — ærlighetsregel i entrypoint, github-issues-prs og
  kodeagentenes resultatkontrakt: påstå kun det som er verifisert gjort i
  kjøringen. (3) PR-er mot `main` i stedet for `v2.0` — base-branch skal
  navngis eksplisitt i delegeringsprompter og `gh pr create --base` er
  obligatorisk; kryssrepo krever fullt kvalifisert `Closes owner/repo#nr`.
  (4) Duplisert/blandet arbeid (#60 delegert tre ganger, PR #78 blandet
  scope) — duplikatsjekk før issue/delegering/koding, én oppgave per PR,
  branch opprettes fra `origin/<base>` før filer røres. I tillegg:
  bot-statusmeldinger (à la CodeRabbits «jeg er i gang») klassifiseres som
  ack, og merge/godkjenning delegeres aldri — det er menneskets
  review-gate. Kildene er KB-innboksens prosess-læringer fra 21.–22. juli.

- **2026-07-22** — Drift: watch-modusen i `scripts/self-update.ps1` fikk
  hurtigtaster (issue #72): `R` gjenskaper containere med oppdatert
  `.env`-config (`docker compose up -d` + eksisterende helsesjekk — env_file
  leses kun ved recreate, så restart holder ikke), `Q` avslutter ryddig.
  Uendret config = ingen recreate og ingen helsesjekk-venting. Uten
  interaktiv konsoll (redirigert stdin/tjeneste) degraderer ventingen til
  ren sleep som før. Reload rører hverken images, git eller
  `:rollback`-taggene.

- **2026-07-22** — GitHub-polleren ignorerer selvutløste hendelser (issue
  #63): før et event køes sjekkes aktøren bak notifikasjonen — for assigns
  siste `assigned`-event fra issue-events-API-et (`getLastAssigner`). Kun
  assignment-hendelser self-filteres når aktøren er pålitelig attribuerbar;
  mention/team_mention-hendelser behandles alltid som menneskeutløst siden
  aktøren ikke kan utledes pålitelig fra notifikasjonens `latest_comment_url`
  (kan peke på eldre bot-kommentar selv om en bruker trigget hendelsen). Er
  aktøren botens egen login markeres tråden som lest uten agent-event
  (debug-logges). Feiler oppslaget behandles hendelsen som menneskeutløst —
  arbeidsordrer droppes aldri stille. Stopper selvloopen opprett issue →
  self-assign → notifikasjon → behandle eget issue.

- **2026-07-22** — Slack-reaksjoner filtreres (issue #61): `onReaction` i
  `SlackConnector` håndterer nå kun reaksjoner på botens egne meldinger eller
  i tråder boten deltar i — før la den working-reaksjon på alt i alle kanaler
  den var medlem av. Teksthentingen for reaksjons-eventer bruker
  `conversations.replies` i stedet for `conversations.history`, som ikke ser
  trådsvar («fant ikke meldingsteksten»); samme kall gir tråddeltakelsen, og
  filteret evalueres før noen reaksjon legges på.

- **2026-07-22** — Førstelinje-router i integrations (issue #52): innkommende
  events annoteres med `classification` (action/feedback/ack/delegate — ett
  strukturert kall mot en liten lokal modell) og `related_activities`
  (embeddings-basert cosine-matching mot åpne Slack-tråder/GitHub-issues på
  tvers av kanaler; indeksen persisteres i `integrations-state`) før de
  appendes til innboksen. Konfigureres med `ROUTER_BASE_URL`/`ROUTER_MODEL`/
  `ROUTER_API_KEY`/`ROUTER_EMBEDDING_MODEL` m.fl.; tom `ROUTER_BASE_URL` = av
  (bakoverkompatibelt), og feil/timeout gir alltid uannotert event — routeren
  annoterer bare, den dropper eller omruter aldri.

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
