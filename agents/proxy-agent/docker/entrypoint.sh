#!/usr/bin/env bash
# Entrypoint for Pi-agenten. To moduser:
#   watch            – poller TRIGGER_FILE (jsonl) og kjører pi per nye event
#   oneshot <tekst>  – kjører pi én gang med prompten fra argument/AGENT_PROMPT/stdin
#   pi <args...>     – kjør pi direkte (f.eks. `pi --version`)
set -euo pipefail

TRIGGER_FILE="${TRIGGER_FILE:-/triggers/inbox.jsonl}"
RESULT_FILE="${RESULT_FILE:-/triggers/results.jsonl}"
LOG_DIR="${LOG_DIR:-/triggers/logs}"
STATE_FILE="${STATE_FILE:-/triggers/.state}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
PI_MODEL="${PI_MODEL:-}"

# Lokalt/OpenAI-kompatibelt LLM-endepunkt (f.eks. Envoy AI Gateway på hosten).
# Settes LLM_BASE_URL genereres ~/.pi/agent/models.json ved oppstart, og
# LLM_MODEL_ID brukes som default modell (med mindre PI_MODEL overstyrer).
LLM_BASE_URL="${LLM_BASE_URL:-}"
LLM_MODEL_ID="${LLM_MODEL_ID:-local}"
LLM_API_KEY="${LLM_API_KEY:-none}"

if [[ -n "$LLM_BASE_URL" ]]; then
  mkdir -p "$HOME/.pi/agent"
  jq -n \
    --arg baseUrl "$LLM_BASE_URL" \
    --arg apiKey "$LLM_API_KEY" \
    --arg model "$LLM_MODEL_ID" \
    '{providers: {"local-llm": {baseUrl: $baseUrl, api: "openai-completions", apiKey: $apiKey, models: [{id: $model}]}}}' \
    >"$HOME/.pi/agent/models.json"
  [[ -n "$PI_MODEL" ]] || PI_MODEL="$LLM_MODEL_ID"
fi

pi_args=(-p)
if [[ -n "$PI_MODEL" ]]; then
  pi_args+=(--model "$PI_MODEL")
fi

# Kunnskapsbase (OKF-wiki): KB_REPO klones/pulles til KNOWLEDGE_DIR ved
# oppstart. KB_REPO kan være full URL eller owner/repo (github.com antas).
# Tokenet leses fra env av credential-helperen ved bruk — det lagres aldri
# i .git/config. Tom KB_REPO/KB_GH_TOKEN = kunnskapsbasen er inaktiv.
KB_REPO="${KB_REPO:-}"
KB_GH_TOKEN="${KB_GH_TOKEN:-}"
KNOWLEDGE_DIR="${KNOWLEDGE_DIR:-/knowledge}"
KB_CRED_HELPER='!f() { echo username=x-access-token; echo "password=${KB_GH_TOKEN}"; }; f'

sync_knowledge() {
  [[ -n "$KB_REPO" && -n "$KB_GH_TOKEN" ]] || return 0
  local url="$KB_REPO"
  case "$url" in
    http://*|https://*) url="${url%.git}.git" ;;
    *) url="https://github.com/${KB_REPO}.git" ;;
  esac
  mkdir -p "$KNOWLEDGE_DIR"
  # Bind-mount fra hosten kan ha en annen eier enn container-brukeren;
  # uten safe.directory nekter git å røre repoet ("not in a git directory").
  git config --global --add safe.directory "$KNOWLEDGE_DIR" 2>/dev/null || true
  if [[ -d "$KNOWLEDGE_DIR/.git" ]]; then
    git -C "$KNOWLEDGE_DIR" config credential.helper "$KB_CRED_HELPER" 2>/dev/null || true
    if git -C "$KNOWLEDGE_DIR" pull --ff-only --quiet 2>/dev/null; then
      log "Kunnskapsbase: $KNOWLEDGE_DIR oppdatert fra remote"
    else
      log "Kunnskapsbase: pull feilet – fortsetter med eksisterende innhold"
    fi
  elif [[ -z "$(ls -A "$KNOWLEDGE_DIR" 2>/dev/null)" ]]; then
    if git clone --config credential.helper="$KB_CRED_HELPER" --quiet "$url" "$KNOWLEDGE_DIR" 2>/dev/null; then
      log "Kunnskapsbase: klonet til $KNOWLEDGE_DIR"
    else
      log "Kunnskapsbase: klarte ikke klone KB_REPO – fortsetter uten"
    fi
  else
    log "Kunnskapsbase: $KNOWLEDGE_DIR er ikke tom og ikke et git-repo – hopper over sync"
  fi
  # Klargjør for fangst av læringer (M3): agenten committer selv i
  # /knowledge, så repoet trenger identitet — og evt. lokale commits som
  # ikke kom av gårde ved forrige push-feil prøves på nytt her.
  if [[ -d "$KNOWLEDGE_DIR/.git" ]]; then
    git -C "$KNOWLEDGE_DIR" config user.name  "${KB_GIT_NAME:-proxy-agent}" 2>/dev/null || true
    git -C "$KNOWLEDGE_DIR" config user.email "${KB_GIT_EMAIL:-proxy-agent@users.noreply.github.com}" 2>/dev/null || true
    git -C "$KNOWLEDGE_DIR" config pull.rebase true 2>/dev/null || true
    git -C "$KNOWLEDGE_DIR" push --quiet 2>/dev/null || true
  fi
}

# Skills bakt inn i imaget (se Dockerfile). Lastes eksplisitt med --skill
# siden ~/.pi ligger på et volum som ville skygget image-innhold.
SKILLS_DIR="${SKILLS_DIR:-/opt/pi-skills}"
if [[ -d "$SKILLS_DIR" ]]; then
  for skill_dir in "$SKILLS_DIR"/*/; do
    [[ -f "$skill_dir/SKILL.md" ]] && pi_args+=(--skill "${skill_dir%/}")
  done
fi

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

# Marker the agent must print before its machine-readable result block.
RESULT_MARKER="===AGENT-RESULT==="

classification_block() {
  cat <<EOF
---
Du er en agent som mottar henvendelser fra Slack/GitHub via en bro. Gjør to ting:

1) Klassifiser henvendelsen over som NØYAKTIG én av:
   - "action": brukeren ber om at noe konkret skal gjøres (en oppgave/jobb). Utfør oppgaven. Arbeidskatalogen er /workspace.
   - "feedback": brukeren gir en tilbakemelding/korrigering som bør noteres, men som ikke er en ny konkret oppgave.
   - "ack": en ren kvittering/bekreftelse (f.eks. "ok", "takk", et tommel-opp) som ikke krever handling.

2) Formuler et kort, vennlig svar på norsk til brukeren ("reply"). For "ack" kan "reply" være tom.

HELT TIL SLUTT skriver du en linje med KUN teksten:
$RESULT_MARKER
og deretter ett JSON-objekt (kan gå over flere linjer):
{"intent":"action|feedback|ack","reply":"<svaret ditt på norsk>"}
EOF
}

# Kunnskapssyntese (M4/M5): kjøres automatisk i watch-modus når innboksen
# har kandidater og det er minst SYNTHESIS_INTERVAL_HOURS siden sist.
# 0 = aldri automatisk (syntese kan alltid trigges manuelt via et event).
SYNTHESIS_INTERVAL_HOURS="${SYNTHESIS_INTERVAL_HOURS:-24}"
SYNTHESIS_STATE_FILE="${SYNTHESIS_STATE_FILE:-/triggers/.synthesis-last}"

synthesis_due() {
  [[ "$SYNTHESIS_INTERVAL_HOURS" =~ ^[0-9]+$ ]] || return 1
  (( SYNTHESIS_INTERVAL_HOURS > 0 )) || return 1
  [[ -f "$KNOWLEDGE_DIR/index.md" ]] || return 1
  [[ -s "$KNOWLEDGE_DIR/inbox/learnings.jsonl" ]] || return 1
  local last=0 now
  if [[ -f "$SYNTHESIS_STATE_FILE" ]]; then
    last=$(<"$SYNTHESIS_STATE_FILE")
    [[ "$last" =~ ^[0-9]+$ ]] || last=0
  fi
  now=$(date +%s)
  (( now - last >= SYNTHESIS_INTERVAL_HOURS * 3600 ))
}

run_synthesis() {
  local ts log_file rc
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  log_file="$LOG_DIR/synthesis-$ts.log"
  # Stemples før kjøring, så en feilende syntese ikke spinner hvert poll
  date +%s >"$SYNTHESIS_STATE_FILE"
  log "Kunnskapssyntese: starter (logg: $log_file)"
  set +e
  pi "${pi_args[@]}" "Kjør kunnskapssyntese på kunnskapsbasen i $KNOWLEDGE_DIR: følg prosedyren i knowledge-synthesis-skillen trinn for trinn." >"$log_file" 2>&1
  rc=$?
  set -e
  log "Kunnskapssyntese: ferdig (exit $rc)"
}

# Kort hint om kunnskapsbasen, kun når den faktisk er tilgjengelig.
knowledge_block() {
  [[ -f "$KNOWLEDGE_DIR/index.md" ]] || return 0
  printf 'Kunnskapsbase: %s er en OKF-wiki med domenekunnskap og tidligere lærdommer. Les %s/index.md og følg lenkene derfra hvis oppgaven kan dra nytte av det.\n\n' "$KNOWLEDGE_DIR" "$KNOWLEDGE_DIR"
}

build_prompt() {
  local event_json="$1" prompt kb
  kb=$(knowledge_block)
  [[ -z "$kb" ]] || kb="$kb"$'\n\n'
  prompt=$(jq -r '.prompt // empty' <<<"$event_json")
  if [[ -n "$prompt" ]]; then
    printf '%s\n\n%sKontekst – komplett trigger-event (JSON):\n%s\n\n%s\n' "$prompt" "$kb" "$event_json" "$(classification_block)"
  else
    printf 'Du har mottatt et eksternt trigger-event (f.eks. fra Slack eller GitHub).\nUtfør oppgaven eventet beskriver. Arbeidskatalogen er /workspace.\n\n%sEvent (JSON):\n%s\n\n%s\n' "$kb" "$event_json" "$(classification_block)"
  fi
}

# Extracts the JSON block the agent printed after RESULT_MARKER (everything
# after the last marker line). Empty if the agent produced no valid block.
extract_result_json() {
  local log_file="$1" block
  block=$(awk -v m="$RESULT_MARKER" '$0==m{f=1;buf="";next} f{buf=buf $0 ORS} END{printf "%s",buf}' "$log_file")
  if [[ -n "$block" ]] && jq -e . >/dev/null 2>&1 <<<"$block"; then
    printf '%s' "$block"
  fi
}

process_event() {
  local event_json="$1" id started finished exit_code log_file prompt
  id=$(jq -r '.id // empty' <<<"$event_json")
  [[ -n "$id" ]] || id="evt-$(date +%s%N)"
  id="${id//[^a-zA-Z0-9._-]/_}"

  log_file="$LOG_DIR/$id.log"
  prompt=$(build_prompt "$event_json")
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  log "Behandler event $id ..."

  set +e
  pi "${pi_args[@]}" "$prompt" >"$log_file" 2>&1
  exit_code=$?
  set -e

  finished=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Pull the agent's classification (intent + reply) out of the log, if present.
  local result_json intent reply
  result_json=$(extract_result_json "$log_file")
  if [[ -n "$result_json" ]]; then
    intent=$(jq -r '.intent // empty' <<<"$result_json")
    reply=$(jq -r '.reply // empty' <<<"$result_json")
  else
    intent=""; reply=""
  fi

  jq -cn \
    --arg id "$id" \
    --arg status "$([[ $exit_code -eq 0 ]] && echo ok || echo error)" \
    --argjson exit_code "$exit_code" \
    --arg log "logs/$id.log" \
    --arg intent "$intent" \
    --arg reply "$reply" \
    --arg started_at "$started" \
    --arg finished_at "$finished" \
    '{id: $id, status: $status, exit_code: $exit_code, log: $log, started_at: $started_at, finished_at: $finished_at}
       + (if $intent != "" then {intent: $intent} else {} end)
       + (if $reply  != "" then {reply:  $reply}  else {} end)' \
    >>"$RESULT_FILE"
  log "Event $id ferdig (exit $exit_code, intent=${intent:-?}, logg: $log_file)"
}

watch_loop() {
  mkdir -p "$LOG_DIR"
  touch "$TRIGGER_FILE" "$RESULT_FILE"

  local processed=0 total line
  if [[ -f "$STATE_FILE" ]]; then
    processed=$(<"$STATE_FILE")
    [[ "$processed" =~ ^[0-9]+$ ]] || processed=0
  fi

  log "Watch-modus: poller $TRIGGER_FILE hvert ${POLL_INTERVAL}s (allerede behandlet: $processed linjer)"
  while true; do
    total=$(wc -l <"$TRIGGER_FILE")
    while (( total > processed )); do
      line=$(sed -n "$((processed + 1))p" "$TRIGGER_FILE")
      processed=$((processed + 1))
      printf '%s' "$processed" >"$STATE_FILE"

      line="${line%$'\r'}"
      [[ -n "${line//[[:space:]]/}" ]] || continue
      if ! jq -e . >/dev/null 2>&1 <<<"$line"; then
        log "Hopper over linje $processed: ugyldig JSON"
        continue
      fi
      process_event "$line"
    done
    if synthesis_due; then
      run_synthesis
    fi
    sleep "$POLL_INTERVAL"
  done
}

sync_knowledge

cmd="${1:-watch}"
case "$cmd" in
  watch)
    watch_loop
    ;;
  oneshot)
    shift || true
    prompt="${*:-${AGENT_PROMPT:-}}"
    if [[ -z "$prompt" ]]; then
      prompt=$(cat)
    fi
    exec pi "${pi_args[@]}" "$prompt"
    ;;
  pi)
    shift
    exec pi "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
