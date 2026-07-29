# nvt-bridge — bro mellom filkontrakten og levende nvt-instanser

Deterministisk supervisor **uten LLM** som kobler pipelinens filkontrakt til
[nvt-agent](https://github.com/mirkoSekulic/nvt-agent)-instanser: den poller
`agents/nvt-fat-developer/triggers/inbox.jsonl`, mapper hvert event til
topicets levende nvt-instans, og injiserer oppgaven som en prompt i sesjonen.

Rollen tilsvarer `scripts/agent-runner.ps1` for engangs-container-agentene,
men mot nvt i stedet for `docker run`. Design: [`doc/plans/nvt-agent-integrasjon.md`](../../doc/plans/nvt-agent-integrasjon.md).
Sporet er issue #95; dette er M1 (#97).

> **Status: kjernen er implementert og testet; oppsettet mot ekte
> nvt-instanser er ikke verifisert.** Alt som antar noe om nvt (make-mål,
> containernavn, `agentdctl`-format) ligger isolert i
> [`src/nvt/docker.ts`](src/nvt/docker.ts) og er merket «kalibreres mot
> M0-funn» (issue #96). Kjernelogikken testes mot en fake-implementasjon og er
> uavhengig av hvordan den fila ender opp.

## Hva den gjør

1. **Poller** `inbox.jsonl` og finner ubehandlede events — *id uten linje i
   `results.jsonl`*, samme dedupe-regel som resten av pipelinen.
2. **Avleder topic** = `payload.origin.event_id` uten delta-suffiks (`-d1`,
   `-d2`, …), ellers eventets egen id. Topicet er opphavstråden, så
   oppfølgingsevents havner i samme instans og samme samtale.
3. **Mapper topic → instans** i `state/topics.json`. Finnes ingen instans:
   `agent-init` + `agent-up`. Finnes den: gjenbruk den levende sesjonen.
4. **Injiserer prompten**:
   `docker exec <instans> agentdctl prompt --source host --external`.
   `--external` er ikke valgfritt — delegerte prompts er upålitelig input, og
   flagget gir nvt sin «untrusted input»-preamble.
5. **Venter** på `agentdctl signal done`, og verifiserer at agenten faktisk
   skrev resultatlinja.
6. **Rydder**: `agent-down` for topics som har vært stille lenger enn TTL.
   Workspacet beholdes, så instansen kan gjenskapes med samme arbeidskopi.

Serielt innen et topic, parallelt på tvers (maks N). Serialiseringen er ikke
bare ytelse: alle events i et topic deler samme levende tmux-sesjon og samme
git-arbeidskopi.

### Fallback: aldri en fabrikert suksess

Agenten skriver resultatlinja selv. Broen skriver **kun** `status:"error"`:

| Situasjon | Hva broen gjør |
| --- | --- |
| Resultatlinje kom | Ingenting — agentens linje står |
| `signal done` uten resultatlinje innen nådefristen | `status:"error"` med forklaring |
| Verken resultatlinje eller `signal done` innen timeout | `status:"error"` med forklaring |
| Intern feil (instans nede, `make`/`docker` feilet) | `status:"error"` med feilmeldingen |

En `status:"ok"` kan altså bare komme fra agenten. At *hvert* dispatchet event
ender med en resultatlinje er en invariant: uten den ville eventet være evig
ubehandlet, og polleren dispatche det på nytt i ring (samme grunn som
agent-entrypointene har en EXIT-trap).

## Oppstart

```bash
cp .env.example .env
# fyll inn NVT_ROOT (nvt-sjekkouten). Se kommentarene i .env.example.
npm start
```

Tørrkjøring uten nvt — logger hva som ville blitt kjørt, og skriver
`status:"error"`-linjer (ingen fabrikert suksess, heller ikke her):

```bash
NVT_BRIDGE_DRY_RUN=1 npm start
```

Tester og typecheck:

```bash
npm test        # node --test, ingen byggesteg
npm run typecheck
```

### Container (docker-outside-of-docker)

`docker-compose.yml` kjører broen i container med **hostens Docker-socket**
mountet, slik at oppsettet blir likt på Windows/WSL2 og Mac. Det er et bevisst
unntak forbeholdt tiltrodd infrastruktur: broen er deterministisk kode uten
LLM, og *agentcontainerne* får aldri socketen (nvt-instansen har sin egen,
isolerte dind).

**Den viktigste fella:** compose-bind-mounts løses av *hostens* daemon, så
stier broen sender videre må være host-gyldige. Derfor mountes nvt-sjekkouten
og agentens `triggers/` inn i broen på **samme absolutte sti som på hosten**,
styrt av `NVT_ROOT` og `PIPELINE_ROOT`. Adapteren gjør ingen sti-oversetting —
det er et bevisst valg, ikke en glipp. Fallback er å kjøre broen som en vanlig
node-prosess under WSL2; koden er den samme.

## Kode

| Fil | Rolle |
| --- | --- |
| `src/triggers.ts` | Filkontrakten: lesing, dedupe-regelen, resultatlinjer |
| `src/topic.ts` | Topic-avledning og instansnavn |
| `src/scheduler.ts` | Serielt per topic, parallelt på tvers (maks N) |
| `src/state.ts` | `state/topics.json` — topic → instans |
| `src/prompt.ts` | Prompten som injiseres, og fallback-forklaringene |
| `src/bridge.ts` | Orkestreringen og fallback-invariantene |
| `src/nvt/driver.ts` | Interfacet mot nvt |
| `src/nvt/fake.ts` | Fake-implementasjon for tester |
| `src/nvt/dryrun.ts` | Tørrkjøring |
| `src/nvt/docker.ts` | **Ekte adapter — kalibreres mot M0-funn** |

Node ≥ 22.6, ingen runtime-avhengigheter, ingen byggesteg (native
type-stripping), `node --test` — samme stack som `integrations/`.

## Ikke med i M1

- **Driver-leasen** (headless ↔ hands-on ↔ ekstern) er M3 (#99). I M1 er det
  ingen håndheving, så et menneske som jobber i code-server samtidig som broen
  injiserer prompts i samme topic kan kollidere i arbeidskopien.
- **Admin-konsollen** er M2 (#98). `state/topics.json` og `events.jsonl` er
  lesbare i mellomtiden.
- **Rendring av `AGENTS.local.md`** inn i instansen hører til
  `agent-init`-oppsettet og kalibreres mot M0. Malen ligger i
  [`agents/nvt-fat-developer/AGENTS.local.md.tmpl`](../../agents/nvt-fat-developer/AGENTS.local.md.tmpl).
- **Ruta i `AGENT_ROUTES`** er driftskonfig i deploy-klonens `.env` og tas ved
  utrulling — `integrations/src/` er urørt.
