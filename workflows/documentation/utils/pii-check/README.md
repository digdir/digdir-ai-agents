# PII Pattern Checker

Et Python-script for å oppdage personidentifiserbar informasjon (PII) i kodebase, med støtte for whitelist og fil-ignorering.

## Oversikt

PII Pattern Checker scanner filer for potensielle PII-patterns som:
- **Telefonnummer**: Norske 8-siffer og internasjonale nummer (+XX, 00XX)
- **Organisasjonsnummer**: 9 siffer
- **Personnummer**: 11 siffer

Scriptet sammenligner funn mot en konfigurerbar whitelist og rapporterer:
- ✅ **OK**: Godkjente verdier fra whitelist
- ⚠️ **WARN**: Ukjente verdier som kan være ekte PII

## Installasjon

Ingen eksterne avhengigheter - bruker kun Python standard bibliotek.

```bash
# Sjekk at Python 3.6+ er installert
python --version

# Scriptet er klart til bruk
python pii-check.py --help
```

## Grunnleggende bruk

```bash
# Scan gjeldende mappe
python pii-check.py

# Scan spesifikk mappe
python pii-check.py --root-folder "path/to/project"

# Vis kun warnings (skjul OK-meldinger)
python pii-check.py --warn-only

# Bruk custom config-fil
python pii-check.py --config-file "my-config.txt"
```

## Konfigurasjons-fil

Standard: `permitted-data.config`

```config
# Godkjente telefonnummer
#phone
99999999        # Norsk 8-siffer (genererer automatisk +47 og 0047 varianter)
+1234567890     # Internasjonalt nummer (genererer automatisk 00-variant)

# Godkjente organisasjonsnummer  
#org
111222333
987654321

# Godkjente personnummer
#fnr
90909011223
12345678901

# Filer som skal ignoreres
#ignore-files
*.test.cs           # Alle .test.cs filer
*Test*.cs           # Alle filer med "Test" i navnet
test/*              # Alle filer i test/ mappe
**/test/**          # Alle filer i test/ mapper på ethvert nivå
node_modules/*      # Node.js moduler
.git/*              # Git-filer
build/*             # Build-output
dist/*              # Distribution-filer
```

### Automatisk variant-generering

Scriptet genererer automatisk internasjonale varianter:

| Du legger inn | Scriptet genererer også |
|---------------|-------------------------|
| `99999999`    | `+4799999999`, `004799999999` |
| `+1234567890` | `001234567890` |
| `001234567890` | `+1234567890` |

## Støttede mønstre

### Telefonnummer
- **Norske**: `99999999`, `99 99 99 99`
- **Internasjonale +**: `+4799999999`, `+47 99 99 99 99`, `+1234567890`
- **Internasjonale 00**: `004799999999`, `0047 9999 9999`, `001234567890`
- **Fleksible mellomrom**: Alle formater kan ha mellomrom

### Organisasjonsnummer
- **Standard**: `111222333`, `111 222 333`

### Personnummer  
- **Standard**: `12345678901`, `123456 78901`

## Ignore-patterns

Støtter glob-patterns for å unngå false positives:

```config
#ignore-files
# Filnavn-patterns
*.test.js           # Alle test JavaScript-filer
*Test.cs            # C# test-klasser
*Spec.ts            # TypeScript spec-filer

# Mappe-patterns
test/*              # Alt i test-mappe
tests/*             # Alt i tests-mappe
__tests__/*         # Jest test-mappe
spec/*              # Spec-filer

# Dype mapper (rekursivt)
**/test/**          # test-mapper på alle nivåer
**/tests/**         # tests-mapper på alle nivåer
**/node_modules/**  # Node moduler overalt

# Standard ignoreringer
.git/*              # Git metadata
build/*             # Build output
dist/*              # Distribution
coverage/*          # Test coverage
.vscode/*           # Editor config
.idea/*             # IntelliJ config
```

## Eksempel-output

```bash
$ python pii-check.py --root-folder "my-project"

PII Pattern Checker
==================
Root folder: my-project
Config file: permitted-data.config
Warn only: False

Loaded permitted values:
  phone: 3 values
  org: 1 values  
  fnr: 1 values
Ignore patterns: 6 patterns
  - *.test.cs
  - test/*
  - node_modules/*

Scanning 45 files (ignored 12 files)...

OK: Accepted PII <phone:99999999> in <src/config.json:15>
WARN: Possible PII found <phone:12345678> in <src/UserService.cs:23>
WARN: Possible PII found <org:123456789> in <docs/examples.md:8>
OK: Accepted PII <fnr:90909011223> in <test-data/valid-users.json:3>

Scan completed.
Warnings: 2, OK: 2
```

## Bruksscenarier

### 1. Pre-commit sjekk
```bash
# Sjekk kun endrede filer før commit
python pii-check.py --root-folder "." --warn-only
```

### 2. CI/CD pipeline
```bash
# Fail build hvis ukjent PII finnes
python pii-check.py --warn-only > pii-report.txt
if [ -s pii-report.txt ]; then
    echo "PII found - failing build"
    cat pii-report.txt
    exit 1
fi
```

### 3. Dokumentasjon review
```bash
# Sjekk kun markdown-filer
python pii-check.py --root-folder "docs" --warn-only
```

### 4. Kodebase audit
```bash
# Full scan uten test-filer
python pii-check.py --root-folder "." > pii-audit.txt
```

## Testing

Kjør unit tests:
```bash
python test_pii_check.py
# eller
python -m pytest test_pii_check.py -v
```

## Feilsøking

### "No matches found"
- Sjekk at config-filen eksisterer og har riktig format
- Bekreft at `#phone`, `#org`, `#fnr` seksjonene er korrekt formatert

### "Too many false positives"
- Legg til flere ignore-patterns i `#ignore-files` seksjon
- Utvid whitelist med gyldige test-data

### "Missing real PII"
- Sjekk at regex-patterene fanger ønsket format
- Test med `--warn-only` for å se alle funn

### "Performance issues"
- Legg til `node_modules/*`, `build/*`, `dist/*` i ignore-patterns
- Begrens scan til spesifikke mapper med `--root-folder`

## Tilpasning

For å legge til nye PII-typer, rediger `pii-check.py`:

1. Legg til regex-pattern i `PATTERNS` dictionary
2. Legg til normaliserings-logikk i `normalize_value()`
3. Oppdater config-loading i `load_permitted_values()`
4. Legg til tester i `test_pii_check.py`

## Sikkerhet

⚠️ **Viktig**: Config-filen kan inneholde sensitive test-data. Vurder:
- Ikke commit ekte PII til Git (bruk dummy-data)
- Beskytt config-filer med passende tilgangskontroll
- Roter ut ekte data hvis det kommer i config ved uhell

## Lisens

Dette scriptet er utviklet for Team Core ved Altinn og er ment for intern bruk.