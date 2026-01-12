# Doc Review - Human-in-the-Loop Documentation Review Tool

Et verktøy for visuell gjennomgang av dokumentasjonsendringer med diff-visning og redigeringsmuligheter.
Integreres med Claude Code via MCP (Model Context Protocol).

## Funksjoner

- **4-kolonners diff-visning** for ultrawide-skjermer (gammel NB | ny NB | ny EN | gammel EN)
- **Responsivt layout** som tilpasser seg skjermstørrelse
- **Inline redigering** med Monaco Editor (samme editor som VS Code)
- **Kommentarfunksjon** for å gi tilbakemelding til AI
- **Sesjonshåndtering** som bevarer historikk mellom review-runder
- **Git-integrasjon** for automatisk staging av godkjente endringer

## Installasjon

```bash
cd workflows/documentation/utils/differ
npm install
npm run build
```

## Bruk med Claude Code

### 1. Konfigurer MCP-server

Legg til i din Claude Code MCP-konfigurasjon (`.claude/settings.json` eller globalt):

```json
{
  "mcpServers": {
    "doc-review": {
      "command": "node",
      "args": ["workflows/documentation/utils/differ/dist/mcp/server.js"],
      "cwd": "/sti/til/digdir-ai-agents"
    }
  }
}
```

### 2. Bruk i arbeidsflyt

Claude Code vil nå ha tilgang til `review_documentation`-verktøyet:

```
AI: Jeg har oppdatert dokumentasjonen. La meg åpne review-verktøyet.
[Kaller review_documentation med nb_file="path/to/_index.nb.md"]
```

## MCP Tools

### `review_documentation`

Åpner visuell review-grensesnitt i nettleseren.

**Parametre:**
- `nb_file` (påkrevd): Sti til norsk markdown-fil
- `en_file` (valgfri): Sti til engelsk markdown-fil for oversettelsesgjennomgang
- `session_id` (valgfri): Gjenoppta tidligere review-sesjon

**Returverdier:**
- `status`: "approved" | "rejected" | "edited" | "cancelled"
- `feedback`: Tilbakemelding fra reviewer (ved avvisning)
- `sessionId`: ID for å gjenoppta sesjonen

### `get_review_feedback`

Hent akkumulert tilbakemelding fra en review-sesjon.

**Parametre:**
- `session_id` (valgfri): Sesjon-ID
- `nb_file` (valgfri): Sti til norsk fil (brukes for å finne sesjon)

## Arbeidsflyt

```
┌─────────────────────────────────────────────────────┐
│ 1. Claude Code skriver/oppdaterer norsk dokumentasjon
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ 2. Claude Code kaller review_documentation           │
│    → Nettleser åpnes med review-grensesnitt         │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ 3. Menneske reviewer                                 │
│    - Ser diff mot forrige versjon                   │
│    - Kan redigere direkte                           │
│    - Legger til kommentarer ved behov               │
│    - Klikker "Godkjenn" eller "Avvis"               │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌───────────────────┐         ┌───────────────────┐
│ Godkjent:         │         │ Avvist:           │
│ → Fortsett til    │         │ → Claude får      │
│   oversettelse    │         │   tilbakemelding  │
│   eller PR        │         │ → Ny runde        │
└───────────────────┘         └───────────────────┘
```

## Utvikling

```bash
# Kjør TypeScript-kompilator i watch-modus
npm run dev

# Start web-server direkte (for testing)
node dist/server.js path/to/_index.nb.md path/to/_index.en.md

# Kjør MCP-server
npm run start:mcp
```

## Filstruktur

```
differ/
├── src/
│   ├── mcp/
│   │   └── server.ts      # MCP server
│   ├── lib/
│   │   ├── git.ts         # Git-operasjoner
│   │   ├── diff.ts        # Diff-logikk
│   │   ├── markdown.ts    # Markdown-parsing
│   │   └── state.ts       # Sesjonshåndtering
│   ├── web/
│   │   ├── index.html     # Frontend HTML
│   │   ├── styles.css     # Styling
│   │   └── app.js         # Frontend JavaScript
│   └── server.ts          # Web server
├── package.json
├── tsconfig.json
└── README.md
```

## Konfigurasjon

Sesjonstilstand lagres i `.doc-review-state/`-katalogen i repo-roten.
Denne katalogen er automatisk lagt til i `.gitignore`.

## Tastatursnarvøyer

- `Ctrl/Cmd + S`: Godkjenn endringer
- `Escape`: Lukk feedback-dialog
