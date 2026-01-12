# CLAUDE.md

## Claude: Primary Instructions  

**If you are Claude, you MUST follow these instructions:**

1. **Your primary workflow file** is `workflows/documentation/CLAUDE.md`
2. **Your agent files** are located in `workflows/documentation/.claude/agents/`  
3. **NEVER** use instructions from the `.github/` directory

**Link hygiene requirements:** Always validate internal links and anchors before completing a task. Ensure the correct language prefix is used and verify that the destination heading exists. Run the same `hyperlink --check-anchors --sources content/ public/` command when available, or manually confirm the slug in the target document.

## Oversikt over repoet
Dette er undermappen `/workflows/documentation`, som er rotmappen spesielt tilpasset for å skrive, oversette og forbedre prosadokumentasjon.

## Tilgjengelige oversettings- og skriveagenter
- Bruk `technical-writer`-agenten for å forfatte tekniske dokumentasjonstekster
- Bruk `language-editor-nb` og `language-editor-en`-agentene for oversettelse og språkforbedring

## Verktøy for kvalitetssikring

### Borealis - AI-assistert språkforbedring (norsk)
Bruk **refine-language**-skillen for å få språkforbedringsforslag på norsk tekst via den norske språkmodellen Borealis:

```bash
python .claude/skills/refine-language/scripts/borealis.py "<tekst som skal forbedres>"
```

**Merk:** Krever at LM Studio kjører lokalt med `borealis-4b-instruct-preview`-modellen lastet inn.

### Doc-review - Human-in-the-loop kvalitetssikring
Bruk doc-review MCP-verktøyet for å få menneskelig godkjenning av dokumentasjon:

```
mcp__doc-review__review_documentation med:
- nb_file: sti til norsk fil (påkrevd)
- en_file: sti til engelsk fil (valgfritt, for side-by-side sammenligning)
- session_id: for å gjenoppta tidligere review (valgfritt)
```

Revieweren kan:
- Se endringer med diff-markering
- Sammenligne norsk og engelsk side-by-side
- Redigere innhold direkte i nettleseren
- Legge til kommentarer
- Godkjenne eller avslå med tilbakemelding

For å hente tilbakemelding fra en avslått review:
```
mcp__doc-review__get_review_feedback med:
- session_id: eller nb_file for å finne sesjonen
```

## Veiledning for å løse GitHub issues som krever teknisk dokumentasjon i altinn-studio-docs
Bruk undermappen `./repos` til å klone repo-er inn i (i nye undermapper), etter behov. For eksempel hvis du trenger å arbeide med både brukerdokumentasjon og se på kode fra et kode-repo.

Hoveddokumentasjonen som brukerne ser, ligger i repo [altinn-studio-docs](https://github.com/Altinn/altinn-studio-docs). Å produsere kvalitetsinnhold i dette repo-et er hovedmålet for denne arbeidsflyten. Se tips for å skrive klart og konsist nedenfor.

### Viktige retningslinjer:
- Skriv alltid på norsk først, deretter engelsk
- Skriv primært på **norsk bokmål** (konservativ form)
- Alt innhold må oversettes til engelsk
- Følg `TERMINOLOGY.md` for godkjente oversettelser
- Bruk language-agenter proaktivt for språkkvalitet
- Følg Diátaxis strengt - explanation vs guide vs tutorial vs reference
- Sørg for at interne lenker peker til riktig språk ved å bruke `/nb/`- eller `/en/`-prefiks


### Forberedelse og planlegging

#### Analyser GitHub issue
- Bruk `gh issue view [nummer] --repo [repo]` for å hente detaljer
- Identifiser kravene i "Acceptance Criteria"
- Forstå teknisk kontekst og målgruppe
- 
#### Klon og utforsk dokumentasjonsstruktur
```bash
cd repos
gh repo clone Altinn/altinn-studio-docs
```
- Utforsk eksisterende struktur med `find` og `LS`
- Les eksisterende dokumentasjon for å forstå stil og format
- Identifiser korrekt plassering (tutorial/guide/explanation/reference)

#### Opprett todo-liste
- Bruk TodoWrite-verktøyet for å planlegge oppgaven
- Del opp i konkrete, målbare oppgaver
- Oppdater status underveis for god sporbarhet

### Skriving av dokumentasjon
   
#### Opprett norsk versjon først
- Filnavn: `_index.nb.md`
- Front matter med title, description og weight
- Følg eksisterende dokumentasjonsstruktur og tone
- Bruk konkrete eksempler og praktiske scenarios
- Strukturer med tydelige overskrifter og underkapitler

##### Følg Diátaxis-modellen
Bruk **Diátaxis-modellen** for dokumentasjonstyper:
- **Innføring (Tutorial)**: Læringsfokuserte, trinn-for-trinn veiledninger
- **Guide (How-to)**: Oppgavefokuserte, problemløsende instruksjoner
- **Forklaring (Explanation)**: Forståelsesfokusert, konseptuelt innhold
- **Referanse (Reference)**: Informasjonsfokuserte, detaljerte spesifikasjoner

##### Kvalitetssikring av norsk tekst
1. Bruk language-editor-nb agenten for språkvask:
   ```
   Task med subagent_type: "language-editor-nb"
   ```
2. Bruk Borealis for AI-assistert språkforbedring:
   ```bash
   python .claude/skills/refine-language/scripts/borealis.py "<tekst>"
   ```
3. Be om gjennomgang mot WRITING-GUIDE.md og TERMINOLOGY.md
4. Implementer forbedringsforslag

#### Sjekkpunkt 1: Godkjenning av norsk tekst
**Før oversettelse**, send norsk versjon til menneskelig godkjenning:

```
mcp__doc-review__review_documentation med:
- nb_file: sti til norsk fil
```

Iterer basert på tilbakemeldinger til den norske teksten er godkjent. Dette sikrer at oversettelsen starter fra et kvalitetssikret utgangspunkt.

#### Oversett til engelsk
- Filnavn: `_index.en.md`
- Behold samme struktur og weight
- Tilpass til engelsk idiomatikk
- Bruk godkjent terminologi fra TERMINOLOGY.md

#### Sjekkpunkt 2: Godkjenning av begge versjoner
Etter oversettelse, send begge versjoner til menneskelig godkjenning for sammenligning:

```
mcp__doc-review__review_documentation med:
- nb_file: sti til norsk fil
- en_file: sti til engelsk fil
```

Revieweren kan sammenligne norsk og engelsk side-by-side. Iterer basert på tilbakemeldinger til begge versjoner er godkjent.

### Tekniske sjekker

#### 8. PII-kontroll
Bruk PII-verktøyet for å kontrollere at det kun er godkjent eksempel-data som benyttes. Erstatt med nye lovlige verdier dersom du har benyttet ugyldige verdier.

Lovlige verdier er konfigurert i `pii-permitted-data.config`

```bash
python utils/pii-check/pii-check.py --root-folder [sti]
```

Eksempler:

```bash
# Skann gjeldende katalog for PII
python workflows/documentation/utils/pii-check/pii-check.py

# Skann spesifikk mappe
python workflows/documentation/utils/pii-check/pii-check.py --root-folder "sti/til/prosjekt"

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
- **Viktig**: Det kan være bedre å be om at Hugo startes ut-av-prosess siden det vanligvis ikke kjører i daemon-modus, og kan være vanskelig å håndtere (restart etc.). Be om hjelp.

## Generell skriveveiledning
VIKTIG: Bruk og følg disse retningslinjene når du arbeider med tekst (spesielt i repo-et for altinn-studio-docs)

@WRITING-GUIDE.md

## Terminologi
VIKTIG: Bruk og følg disse begrepene og oversettelsene

@TERMINOLOGY.md

## Kommandoer å huske

Lese GitHub issue
```bash
gh issue view [nummer] --repo [repo]
```

PII-sjekk
```bash
python utils/pii-check/pii-check.py --root-folder [sti]
```