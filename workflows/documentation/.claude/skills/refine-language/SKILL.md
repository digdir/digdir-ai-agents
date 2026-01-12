---
name: refine-language
description: Forbedrer norske tekster ved hjelp av den norske språkmodellen Borealis (via LM Studio)
---

# Forbedre tekst med Borealis

Forbedrer norske tekster ved hjelp av den norske språkmodellen Borealis (via LM Studio).

## Instruksjoner

Når brukeren ber om å forbedre en tekst:

1. Ekstraher teksten som skal forbedres fra brukerens melding
2. Kjør scriptet som ligger i `scripts/`-mappen:

```bash
python .claude/skills/refine-language/scripts/borealis.py "<teksten som skal forbedres>"
```

3. Vurder forslagene kritisk og vis resultatet til brukeren
4. Implementer forbedringene i dokumentasjonen

## Bruk i dokumentasjonsarbeidsflyten

Denne skill-en brukes i fase 2 av dokumentasjonsarbeidsflyten, etter at første utkast på norsk er skrevet og før menneskelig godkjenning (sjekkpunkt 1).

## Feilhåndtering

Hvis scriptet returnerer en feilmelding, informer brukeren om å:
- Starte LM Studio
- Laste inn modellen `borealis-4b-instruct-preview`
