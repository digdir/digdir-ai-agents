# CLAUDE.md

## Oversikt over repoet
Dette er undermappen `/workflows/documentation`, som er rotmappen spesielt tilpasset for å skrive, oversette og forbedre prosadokumentasjon.

## Tilgjengelige oversettings- og skriveagenter
- Bruk `technical-writer`-agenten for å forfatte tekniske dokumentasjonstekster
- Bruk `language-editor-nb` og `language-editor-en`-agentene for oversettelse og språkforbedring

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
- Bruk language-editor-nb agenten for språkvask:
```
Task med subagent_type: "language-editor-nb"
```
- Be om gjennomgang mot WRITING-GUIDE.md og TERMINOLOGY.md
- Implementer forbedringsforslag

#### Oversett til engelsk
- Filnavn: `_index.en.md`
- Behold samme struktur og weight
- Tilpass til engelsk idiomatikk
- Bruk godkjent terminologi fra TERMINOLOGY.md

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

@./WRITING-GUIDE.md

## Terminologi
VIKTIG: Bruk og følg disse begrepene og oversettelsene

@./TERMINOLOGY.md

## Kommandoer å huske

Lese GitHub issue
```bash
gh issue view [nummer] --repo [repo]
```

PII-sjekk
```bash
python utils/pii-check/pii-check.py --root-folder [sti]
```