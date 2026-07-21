# integrations

A small local bot that listens for GitHub and Slack events and reacts to them.
This first iteration uses a **pull / websocket** pattern only — it never exposes
an inbound webhook endpoint, so it can run entirely from your laptop.

## What it does

**GitHub** (polls the notifications API for the token's user):
- When the bot is **assigned** to an issue or PR → the assignment is a **work
  order**: it stays in place (the bot account owns the issue end-to-end) and
  the issue is handed to the agent queue, same as a mention.
- When the bot is **@-mentioned** in a comment or body → it reacts with 🚀
  (`rocket`, configurable) on the triggering comment (or the issue/PR itself).

**Slack** (connects over Socket Mode — a websocket, no public URL needed):
- On start it sets its presence to **active** (green dot); on shutdown it sets
  itself **away**.
- In a **1:1 DM** → it reacts with 🤷 (`shrug`, configurable) to **every**
  message (they are all directed at the bot).
- In **channels, private groups, group DMs and threads** → it only reacts when
  the bot is **@-mentioned**. Other messages are ignored.
- It also picks up **emoji reactions** on any message (`reaction_added`). When
  the queue bridge is on, the reaction and the message it sits on are handed to
  the agent, which interprets what the reaction means (e.g. a 👍 as positive
  feedback). The bot ignores its own reactions to avoid loops.

**Agent queue bridge** (optional — connects to the `proxy-agent` LLM worker):
- When enabled, each event the bot reacts to is also handed off to
  [`proxy-agent`](../agents/proxy-agent) by appending one JSON line to its
  `triggers/inbox.jsonl`. `proxy-agent` runs the LLM agent in an isolated Docker
  container and writes its answer to `triggers/results.jsonl` + `logs/<id>.log`.
- The bot polls `results.jsonl` and delivers each answer back where it came
  from, based on how the agent **classified** the input (`intent`):
  - **`action`** / **`feedback`** → post the agent's `reply` as a **threaded
    reply** in Slack / an **issue/PR comment** on GitHub.
  - **`ack`** (a pure "noted"/thanks) → post nothing, just add an
    acknowledgement reaction (Slack ✅ `white_check_mark`, GitHub 👍 `+1`).
  - Results without an `intent` (older proxy-agent) fall back to posting the log.
- While the agent works, the bot shows a **"working" reaction** (Slack
  🤔 `thinking_face`, GitHub 👀 `eyes`) on the triggering message and **removes
  it once the result is delivered**. (When the bridge is off, it instead leaves
  a persistent acknowledgement reaction — 🤷 / 🚀.)

The bot and proxy-agent agree on a small **result contract** in `results.jsonl`
(all classification fields optional, so it stays backward compatible):

```jsonc
{ "id": "…", "status": "ok",
  "intent": "action" | "feedback" | "ack" | "delegate",  // how the agent read the input
  "reply": "clean answer text to post back", // separate from the raw log
  "delegate": { "agent": "target-agent-name", "prompt": "…", "payload": {…} }, // required with "delegate" — see below

  "log": "logs/<id>.log", … }
```

This is the "receiver" role described in proxy-agent's own README: integrations is
the only side that holds Slack/GitHub tokens; proxy-agent only ever touches the
shared `triggers/` files. Enable it with `AGENT_QUEUE_ENABLED=true` and point
`AGENT_TRIGGERS_DIR` at proxy-agent's `triggers/` directory (both apps run on the
same machine).

**Delegation between agents** (optional — `AGENT_ROUTES`):
- An agent can hand a task off to another agent by answering with
  `intent: "delegate"` and a `delegate` object in its result line:

  ```jsonc
  { "id": "…", "status": "ok", "intent": "delegate",
    "reply": "short interim notice posted to the origin",
    "delegate": { "agent": "local-cc-coding-agent",
                  "prompt": "complete, self-contained task description",
                  "payload": { "issue": "https://github.com/…" } } }
  ```

- integrations (the hub — agents never write to each other's directories)
  appends the task as a new event in the target agent's `inbox.jsonl`
  (`source: "agent"`, `type: "delegation"`, with `payload.origin` linking back
  to the delegating agent and event), and watches **every** configured agent's
  `results.jsonl`.
- The pending reply is remapped, so the target agent's eventual answer is
  posted back to the **original** Slack thread / GitHub issue. The origin gets
  the interim `reply` right away and keeps its "working" reaction until the
  final answer arrives.
- Targets must be allowlisted in `AGENT_ROUTES` (comma-separated agent names,
  resolved as `<AGENT_AGENTS_DIR>/<name>/triggers`). Unknown targets are
  reported back to the origin instead of executed. `AGENT_MAX_DELEGATION_HOPS`
  (default 2) caps chains so two agents cannot ping-pong a task forever.

## Requirements

- **Node ≥ 23** (runs the TypeScript directly via type stripping — no build step),
  or **Bun** (bonus). Node 24 is what this was developed on.

## Setup

```bash
npm install          # or: bun install
cp .env.example .env # then fill in credentials
```

### GitHub credentials

Create tokens **on the bot's own user account**. The bot acts as that user: it
only sees assignments/mentions delivered to that account's notifications.

The notifications API does **not** work with fine-grained PATs, so credentials
are split into two roles:

- **`GITHUB_TOKEN`** — issue/PR actions (react, comment). A **fine-grained** PAT
  with Read+Write on *Issues* and *Pull requests* works, as does a classic `repo`
  token.
- **`GITHUB_TOKEN_CLASSIC_NOTIFICATIONS`** — the notifications API. Must be a
  **classic** PAT with the `notifications` scope.

Single-token shortcut: if you have one **classic** PAT with **both**
`notifications` and `repo` scopes, it works for everything — put it in either
variable and leave the other blank. The two tokens fall back to each other.
(This is often the simplest route for organization repos.)

### Slack credentials

In your Slack app config (https://api.slack.com/apps):
1. **Socket Mode** → enable it. This creates an **App-Level Token** (`xapp-…`)
   with the `connections:write` scope → `SLACK_APP_TOKEN`.
2. **OAuth & Permissions** → add bot scopes `reactions:write`, `reactions:read`
   (to observe reactions), `users:write` (to set active/away presence) and
   `chat:write` (to post the agent's answer back into the thread), plus the
   history scopes for the surfaces you care about (`channels:history`,
   `groups:history`, `im:history`, `mpim:history`). Install to the workspace →
   copy the **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`.
3. **Event Subscriptions** → subscribe to the matching bot events
   (`message.channels`, `message.groups`, `message.im`, `message.mpim`) and
   `reaction_added` (so the bot receives reactions on messages).
4. Invite the bot to the channels it should watch (`/invite @your-bot`).

If your workspace has no `:shrug:` emoji, set `SLACK_REACTION=man-shrugging`
(or `woman-shrugging`).

## Run

```bash
npm start            # Node
npm run start:bun    # Bun
npm run typecheck    # tsc --noEmit
```

Set `LOG_LEVEL=debug` for verbose output. Stop with Ctrl-C (graceful shutdown).

### Run in Docker

```bash
docker compose up -d --build   # from this directory
docker compose logs -f
```

The container reads credentials from the same `.env` file, but compose
overrides `AGENT_TRIGGERS_DIR`/`AGENT_STATE_DIR` with container paths: the
queue is a bind mount of `../agents/proxy-agent/triggers` (shared with the
proxy-agent container) and state lives in a named volume. To run the whole
pipeline (this app + agents) in one go, use the compose file at the repo root
instead.

Each connector is independent: enable one or both via `GITHUB_ENABLED` /
`SLACK_ENABLED`. A failure in one connector is logged and does not stop the other.

## Configuration

All configuration is via `.env` — see [`.env.example`](.env.example) for the full
list and defaults (`GITHUB_TOKEN`, `GITHUB_REACTION`, `GITHUB_POLL_INTERVAL`,
`GITHUB_API_URL`, `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_REACTION`, …).

## How the pull/websocket pattern works here

- **GitHub:** repeatedly calls `GET /notifications` (unread only), honoring the
  server's `X-Poll-Interval` as a lower bound and using `If-Modified-Since` for
  cheap 304s. Handled threads are marked read so they don't reappear.
- **Slack:** opens a websocket via Socket Mode and receives events over it; each
  event is acknowledged immediately. No incoming HTTP endpoint is exposed.
