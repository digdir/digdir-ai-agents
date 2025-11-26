# COPILOT.md

## Oversikt over repoet
Dette er undermappen `/workflows/documentation`, som er rotmappen spesielt tilpasset for å skrive, oversette og forbedre prosadokumentasjon.

## Tilgjengelige oversettings- og skriveagenter

### @technical-writer
Bruk denne agenten for å forfatte tekniske dokumentasjonstekster fra bunnen av.

**Eksempel på bruk:**
```
@technical-writer Create comprehensive documentation for the new OAuth authentication flow
```

### @language-editor.nb
Bruk denne agenten for språkvask og kvalitetssikring av norsk tekst.

**Eksempel på bruk:**
```
@language-editor.nb Review this Norwegian documentation for language quality and clarity
```

### @language-editor.en
Bruk denne agenten for oversettelse til engelsk og språkvask av engelsk tekst.

**Eksempel på bruk:**
```
@language-editor.en Translate this Norwegian documentation to British English
```

## Veiledning for å løse GitHub issues som krever teknisk dokumentasjon i altinn-studio-docs

Bruk undermappen `./repos` til å klone repo-er inn i (i nye undermapper), etter behov. For eksempel hvis du trenger å arbeide med både brukerdokumentasjon og se på kode fra et kode-repo.

Hoveddokumentasjonen som brukerne ser, ligger i repo [altinn-studio-docs](https://github.com/Altinn/altinn-studio-docs). Å produsere kvalitetsinnhold i dette repo-et er hovedmålet for denne arbeidsflyten. Se tips for å skrive klart og konsist nedenfor.

### Viktige retningslinjer:
- Skriv alltid på norsk først, deretter engelsk
- Skriv primært på **norsk bokmål** (konservativ form)
- Alt innhold må oversettes til engelsk
- Følg `TERMINOLOGY.md` for godkjente oversettelser
- Bruk language-editor agenter proaktivt for språkkvalitet
- Følg Diátaxis strengt - explanation vs guide vs tutorial vs reference

### Forberedelse og planlegging

#### Analyser GitHub issue
- Bruk `gh issue view [nummer] --repo [repo]` for å hente detaljer
- Identifiser kravene i "Acceptance Criteria"
- Forstå teknisk kontekst og målgruppe

#### Klon og utforsk dokumentasjonsstruktur
```bash
cd repos
git clone https://github.com/Altinn/altinn-studio-docs.git
# Or if you have GitHub CLI installed:
gh repo clone Altinn/altinn-studio-docs
```
- Utforsk eksisterende struktur
- Les eksisterende dokumentasjon for å forstå stil og format
- Identifiser korrekt plassering (tutorial/guide/explanation/reference)

#### Opprett todo-liste
- Bruk GitHub Copilot's task tracking
- Del opp i konkrete, målbare oppgaver
- Oppdater status underveis for god sporbarhet

### Skriving av dokumentasjon

#### 3-fase arbeidsflyt

**Fase 1: Opprett norsk versjon først**
- Bruk `@technical-writer` for å lage første utkast
- Filnavn: `_index.nb.md`
- Front matter med title, description og weight
- Følg eksisterende dokumentasjonsstruktur og tone
- Bruk konkrete eksempler og praktiske scenarios
- Strukturer med tydelige overskrifter og underkapitler

**Fase 2: Kvalitetssikring av norsk tekst**
- Bruk `@language-editor.nb` for språkvask:
```
@language-editor.nb Review this Norwegian documentation for clarity and correctness
```
- Be om gjennomgang mot WRITING-GUIDE.md og TERMINOLOGY.md
- Implementer forbedringsforslag

**Fase 3: Oversett til engelsk**
- Bruk `@language-editor.en` for oversettelse:
```
@language-editor.en Translate this Norwegian documentation to British English
```
- Filnavn: `_index.en.md`
- Behold samme struktur og weight
- Tilpass til engelsk idiomatikk
- Bruk godkjent terminologi fra TERMINOLOGY.md

### Følg Diátaxis-modellen

Bruk **Diátaxis-modellen** for dokumentasjonstyper:
- **Innføring (Tutorial)**: Læringsfokuserte, trinn-for-trinn veiledninger
- **Guide (How-to)**: Oppgavefokuserte, problemløsende instruksjoner
- **Forklaring (Explanation)**: Forståelsesfokusert, konseptuelt innhold
- **Referanse (Reference)**: Informasjonsfokuserte, detaljerte spesifikasjoner

### Tekniske sjekker

#### PII-kontroll
Bruk PII-verktøyet for å kontrollere at det kun er godkjent eksempel-data som benyttes. Erstatt med nye lovlige verdier dersom du har benyttet ugyldige verdier.

Lovlige verdier er konfigurert i `pii-permitted-data.config`

```bash
python utils/pii-check/pii-check.py --root-folder [sti]
```

**Eksempler:**

```bash
# Skann gjeldende katalog for PII
python workflows/documentation/utils/pii-check/pii-check.py

# Skann spesifikk mappe (f.eks. altinn-studio-docs)
python workflows/documentation/utils/pii-check/pii-check.py --root-folder "repos/altinn-studio-docs"

# Vis kun advarsler
python workflows/documentation/utils/pii-check/pii-check.py --warn-only

# Kjør tester
python workflows/documentation/utils/pii-check/test_pii_check.py
```

## Om Hugo-dokumentasjonsnettsted (altinn-studio-docs)

Hoveddokumentasjonen for brukerne er bygd med Hugo (se instruksjoner i readme-filen i altinn-studio-docs repo-et):
- Nettstedskonfigurasjon: `config.toml` med flerspråklig støtte (norsk/engelsk)
- Tema: Tilpasset `hugo-theme-altinn` i `themes/`-katalogen
- Innholdsstruktur følger Hugo-konvensjoner med `_index.en.md` og `_index.nb.md`-filer
- Statiske ressurser: Swagger-spesifikasjoner, bilder, tilpasset CSS/JS

## Referansefiler

De tilgjengelige agentene vil automatisk lese disse filene når de starter arbeidet:

### Skriveveiledning
`WRITING-GUIDE.md` - Retningslinjer for både norsk og engelsk skriving, inkludert Diátaxis-modellen og 3-fase oversettelsesarbeidsflyt.

### Terminologi
`TERMINOLOGY.md` - Godkjente oversettelser og termer som IKKE skal oversettes (Dialogporten, Altinn, Maskinporten, etc.).

## Kommandoer å huske

**Lese GitHub issue:**
```bash
gh issue view [nummer] --repo [repo]
```

**Klone repository:**
```bash
gh repo clone Altinn/altinn-studio-docs
# Or without GitHub CLI:
git clone https://github.com/Altinn/altinn-studio-docs.git
```

**PII-sjekk:**
```bash
python utils/pii-check/pii-check.py --root-folder [sti]
```

## Hvordan starte med GitHub Copilot

1. **I VS Code:**
   - Åpne Chat-panelet (Ctrl+Alt+I eller Cmd+Alt+I)
   - Bruk `@` for å nevne en agent: `@technical-writer`
   - Gi agenten en oppgave

2. **I Copilot CLI:**
   ```bash
   gh copilot chat
   # Then use @agent-name in your prompts
   ```

3. **På github.com:**
   - Åpne Copilot chat
   - Nevn agenten med `@` i samtalen

## Tips for effektiv bruk

- **Vær spesifikk**: Gi agentene klare instruksjoner og kontekst
- **Bruk riktig agent**: technical-writer for nye tekster, language-editor.nb/en for vask
- **Følg arbeidsflyten**: Norsk → Kvalitetssikring → Engelsk
- **Sjekk terminologi**: Agentene leser TERMINOLOGY.md, men det er lurt å verifisere
- **Kjør PII-sjekk**: Alltid før du commiter dokumentasjon

## Eksempel på komplett arbeidsflyt

```
# 1. Analyser issue
gh issue view 123 --repo Altinn/altinn-studio-docs

# 2. Be technical-writer lage første utkast
@technical-writer Create a guide for configuring message templates in Altinn 3

# 3. Kvalitetssikre norsk tekst
@language-editor.nb Review the Norwegian version for clarity and correctness

# 4. Oversett til engelsk
@language-editor.en Translate the Norwegian documentation to British English

# 5. Kjør PII-sjekk
python workflows/documentation/utils/pii-check/pii-check.py --root-folder repos/altinn-studio-docs
```
