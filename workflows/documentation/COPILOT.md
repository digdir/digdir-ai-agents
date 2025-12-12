# COPILOT.md

## Introduksjon
Dette er en kort brukerveiledning for deg som vil jobbe med dokumentasjon ved hjelp av GitHub Copilot. Her lærer du hvordan du aktiverer riktig agent, setter opp arbeidsflyten og får verktøyet til å produsere og kvalitetssikre innhold på både norsk og engelsk. 

## Oversikt over repoet
I undermappen `/.github/agents`, finner du agentene som er spesielt tilpasset for å skrive, oversette og forbedre prosadokumentasjon.

## Tilgjengelige oversettings- og skriveagenter

### @technical-writer
Denne agenten brukes for å forfatte tekniske dokumentasjonstekster fra bunnen.

### @language-editor-nb
Denne agenten brukes for språkvask og kvalitetssikring av norsk tekst.

### @language-editor-en
Denne agenten brukes for oversettelse til engelsk og språkvask av engelsk tekst.

## Hvordan starte med GitHub Copilot

1. **I VS Code:**
   - Åpne Chat-panelet (Ctrl+Alt+I eller Cmd+Alt+I)
   - Gi agenten en oppgave
   - Inkludere gjerne lenke til github issues

2. **I Copilot CLI:**
   ```bash
   gh copilot chat
   # Then use @agent-name in your prompts
   ```

3. **På github.com:**
   - Åpne Copilot chat
   - Nevn agenten med `@` i samtalen

## Veiledning for å løse GitHub issues som krever teknisk dokumentasjon i altinn-studio-docs

Bruk undermappen `./repos` til å klone repo-er inn i (i nye undermapper), etter behov. For eksempel hvis du trenger å arbeide med både brukerdokumentasjon og se på kode fra et kode-repo. Når du ber verktøyet skrive dokumentasjon for et spesifikt GitHub-issue, henter agenten automatisk nødvendige repoer inn i `./repos`. Husk å inkluderer lenken til selve issuet (for eksempel `https://github.com/Altinn/altinn-studio-docs/issues/1641`) i chatten.


Hoveddokumentasjonen som brukerne ser, ligger i repo [altinn-studio-docs](https://github.com/Altinn/altinn-studio-docs). Å produsere kvalitetsinnhold i dette repo-et er hovedmålet for denne arbeidsflyten. 

## Referansefiler

De tilgjengelige agentene vil automatisk lese disse filene når de starter arbeidet:

### Skriveveiledning
`WRITING-GUIDE.md` - Retningslinjer for både norsk og engelsk skriving, inkludert Diátaxis-modellen og 3-fase oversettelsesarbeidsflyt.

### Terminologi
`TERMINOLOGY.md` - Godkjente oversettelser og termer som IKKE skal oversettes (Dialogporten, Altinn, Maskinporten, etc.).

## Om Hugo-dokumentasjonsnettsted (altinn-studio-docs)

Hoveddokumentasjonen for brukerne er bygd med Hugo (se instruksjoner i readme-filen i altinn-studio-docs repo-et):
- Nettstedskonfigurasjon: `config.toml` med flerspråklig støtte (norsk/engelsk)
- Tema: Tilpasset `hugo-theme-altinn` i `themes/`-katalogen
- Innholdsstruktur følger Hugo-konvensjoner med `_index.en.md` og `_index.nb.md`-filer
- Statiske ressurser: Swagger-spesifikasjoner, bilder, tilpasset CSS/JS

### Tekniske sjekker

#### PII-kontroll
Etter at verktøyet har kommet med forslag til ny eller oppdatert dokumentasjon, bruk PII-verktøyet for å kontrollere at det kun er godkjent eksempel-data som benyttes. Erstatt med nye lovlige verdier dersom du har benyttet ugyldige verdier.

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

## Eksempel på komplett arbeidsflyt

```
# 1. Analyser issue
gh issue view 123 --repo Altinn/altinn-studio-docs

# 2. Be technical-writer lage første utkast
Use technical-writer in `/.github/agents` to create a guide for configuring message templates in Altinn 3

# 3. Kvalitetssikre norsk tekst
Use language-editor-nb in `/.github/agents` to review the Norwegian version for clarity and correctness

# 4. Oversett til engelsk
Use language-editor-en in `/.github/agents` to translate the Norwegian documentation to British English

# 5. Kjør PII-sjekk
python workflows/documentation/utils/pii-check/pii-check.py --root-folder repos/altinn-studio-docs

# 6. Create branch in altinn studio docs repo
cd repos/altinn-studio-docs
git checkout -b docs/new-feature

# 7. Create pull request
git commit -m "Add documentation for [feature]"
git push -u origin docs/new-feature
gh pr create --title "Add documentation for [feature]" --body "..."
```
