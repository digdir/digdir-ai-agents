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

## Teknisk: Diff-algoritmen

### Hvordan diff fungerer

Verktøyet sammenligner **nåværende fil** (working directory) mot **siste commit** (HEAD) i Git.

**Viktig:** For at diff skal vises, må:
1. Filen være i et Git-repository
2. Filen være committet minst én gang (ha Git-historikk)
3. Det eksistere endringer mellom working directory og HEAD

For nye/untracked filer vises kun det nye innholdet uten diff-markering.

### Blokk-matching algoritme

For omstrukturerte dokumenter bruker verktøyet en intelligent blokk-matching algoritme (`matchLinesInBlocks()` i `src/lib/diff.ts`):

1. **Samler blokker** av påfølgende fjernede linjer
2. **Samler blokker** av påfølgende tillagte linjer som følger
3. **Finner beste match** for hver fjernet linje i tillagt-blokken (≥30% likhet)
4. **Sorterer matcher** etter likhet og prosesserer grådigt
5. **Identiske linjer** (100% match) markeres som `unchanged`
6. **Like linjer** markeres som `modified` med karakter-nivå diff

**Eksempel på forbedring:**
```
Før algoritmen:  0 modified, 159 added, 114 removed (alt som separate endringer)
Etter algoritmen: 34 modified, 78 added, 33 removed, 75 unchanged (korrekt matching)
```

### Diff-typer og farger

| Type | Farge | Beskrivelse |
|------|-------|-------------|
| `unchanged` | Hvit | Identiske linjer i begge versjoner |
| `modified` | Oransje | Endrede linjer med inline karakter-diff |
| `added` | Grønn | Nye linjer som ikke fantes i forrige versjon |
| `removed` | Rød | Fjernede linjer som ikke finnes i ny versjon |

### CRLF/LF-håndtering

Algoritmen normaliserer linjeskift (CRLF → LF) før sammenligning for å unngå falske positiver på Windows.

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

## Testing

```bash
# Kjør alle tester
npm test

# Kjør tester i watch-modus
npm run test:watch
```

### Teststruktur

- `src/lib/diff.test.ts` - 31 unit-tester for diff-logikk
- `src/lib/diff.integration.test.ts` - 15 integrasjonstester med reelle fixtures

### Test-fixtures

Test-fixtures ligger i `test-fixtures/`-katalogen:

| Fixture | Beskrivelse |
|---------|-------------|
| `simple-edit/` | Enkel redigering av én linje |
| `added-content/` | Nytt innhold lagt til |
| `removed-content/` | Innhold fjernet |
| `front-matter-change/` | Endring i YAML front-matter |
| `crlf-vs-lf/` | CRLF/LF-normalisering |
| `restructured-doc/` | Betydelig omstrukturert dokument |
| `error-codes-*.md` | Real-world test case med 134→179 linjer |

### Verifiser diff-algoritme direkte

```bash
node -e "
import('./dist/lib/diff.js').then(({computeLineDiff}) => {
  const fs = require('fs');
  const old = fs.readFileSync('test-fixtures/error-codes-old.md', 'utf8');
  const neu = fs.readFileSync('test-fixtures/error-codes-new.md', 'utf8');
  const result = computeLineDiff(old, neu);
  const summary = {
    unchanged: result.filter(l => l.type === 'unchanged').length,
    modified: result.filter(l => l.type === 'modified').length,
    added: result.filter(l => l.type === 'added').length,
    removed: result.filter(l => l.type === 'removed').length
  };
  console.log('Summary:', summary);
});
"
```

## Feilsøking

### Diff vises ikke / tom side

1. **Sjekk at filen har Git-historikk:**
   ```bash
   git log --oneline -1 -- path/to/file.md
   ```
   Hvis ingen output, er filen ikke committet ennå.

2. **Sjekk at det finnes endringer:**
   ```bash
   git diff --stat -- path/to/file.md
   ```

3. **Sjekk at MCP-serveren er bygd:**
   ```bash
   npm run build
   ```

### Identiske linjer vises som modifisert (oransje)

Mulige årsaker:
- **Whitespace-forskjeller:** Trailing spaces eller tabs vs spaces
- **CRLF/LF-forskjeller:** Sjekk med `git diff --check`
- **Gammel build:** Kjør `npm run build` på nytt

### MCP-server starter ikke

1. **Sjekk at stien er korrekt** i MCP-konfigurasjonen
2. **Sjekk at `dist/`-katalogen finnes** (kjør `npm run build`)
3. **Test serveren direkte:**
   ```bash
   node dist/mcp/server.js
   ```

### Nettleser åpnes ikke automatisk

Verktøyet bruker `open`-pakken for å åpne standardnettleseren. Hvis dette ikke fungerer:
1. Åpne manuelt: `http://localhost:3847` (eller porten vist i terminalen)
2. Sjekk at `open`-pakken er installert: `npm list open`
