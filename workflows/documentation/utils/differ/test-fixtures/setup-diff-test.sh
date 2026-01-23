#!/bin/bash
# Setup script for testing diff functionality
# Creates a temporary git repo with two commits to demonstrate diff

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_REPO="$SCRIPT_DIR/test-repo"

echo "Setting up diff test repository..."

# Clean up any existing test repo
rm -rf "$TEST_REPO"
mkdir -p "$TEST_REPO"
cd "$TEST_REPO"

# Initialize git repo
git init
git config user.email "test@example.com"
git config user.name "Test User"

# Create initial version (old)
cat > "_index.nb.md" << 'EOF'
---
title: Opprette en tjeneste
description: Lær hvordan du oppretter en ny tjeneste i Altinn Studio.
weight: 10
---

## Før du begynner

Før du kan opprette en tjeneste, må du ha tilgang til Altinn Studio.
Kontakt din organisasjons administrator for å få tilgang.

## Opprett ny tjeneste

1. Logg inn i Altinn Studio
2. Klikk på **Opprett ny** i toppmenyen
3. Velg **Tjeneste** fra listen
4. Fyll inn navn og beskrivelse

### Navnekonvensjoner

Navnet på tjenesten bør være beskrivende og følge disse reglene:

- Bruk kun bokstaver og tall
- Ikke bruk mellomrom
- Maksimalt 50 tegn

## Neste steg

Etter at tjenesten er opprettet, kan du begynne å bygge skjemaet.
Se [Bygge skjema](/guide/form-builder) for mer informasjon.
EOF

cat > "_index.en.md" << 'EOF'
---
title: Create a service
description: Learn how to create a new service in Altinn Studio.
weight: 10
---

## Before you begin

Before you can create a service, you need access to Altinn Studio.
Contact your organization's administrator to get access.

## Create new service

1. Log in to Altinn Studio
2. Click on **Create new** in the top menu
3. Select **Service** from the list
4. Fill in name and description

### Naming conventions

The service name should be descriptive and follow these rules:

- Use only letters and numbers
- Do not use spaces
- Maximum 50 characters

## Next steps

After the service is created, you can start building the form.
See [Building forms](/guide/form-builder) for more information.
EOF

# Commit initial version
git add .
git commit -m "Initial documentation"

echo "Created initial commit"

# Now modify the files (new version with changes)
cat > "_index.nb.md" << 'EOF'
---
title: Opprette en tjeneste
description: Lær hvordan du oppretter en ny digital tjeneste i Altinn Studio.
weight: 10
---

## Før du begynner

Før du kan opprette en tjeneste, må du ha tilgang til Altinn Studio.
Kontakt din organisasjons administrator for å få tilgang.

Du trenger også en gyldig e-postadresse for varsler.

## Opprett ny tjeneste

1. Logg inn i Altinn Studio med din organisasjonskonto
2. Klikk på **Opprett ny** i toppmenyen
3. Velg **Tjeneste** fra nedtrekkslisten
4. Fyll inn navn og beskrivelse
5. Klikk **Opprett**

### Navnekonvensjoner

Navnet på tjenesten bør være beskrivende og følge disse reglene:

- Bruk kun bokstaver, tall og bindestrek
- Ikke bruk mellomrom eller spesialtegn
- Maksimalt 50 tegn
- Start med en bokstav

## Konfigurer tjenesten

Etter opprettelse kan du konfigurere tilgangsrettigheter og varsler.

## Neste steg

Etter at tjenesten er opprettet, kan du begynne å bygge skjemaet.
Se [Bygge skjema](/guide/form-builder) for mer informasjon.
EOF

cat > "_index.en.md" << 'EOF'
---
title: Create a service
description: Learn how to create a new digital service in Altinn Studio.
weight: 10
---

## Before you begin

Before you can create a service, you need access to Altinn Studio.
Contact your organization's administrator to get access.

You also need a valid email address for notifications.

## Create new service

1. Log in to Altinn Studio with your organization account
2. Click on **Create new** in the top menu
3. Select **Service** from the dropdown list
4. Fill in name and description
5. Click **Create**

### Naming conventions

The service name should be descriptive and follow these rules:

- Use only letters, numbers, and hyphens
- Do not use spaces or special characters
- Maximum 50 characters
- Start with a letter

## Configure the service

After creation, you can configure access permissions and notifications.

## Next steps

After the service is created, you can start building the form.
See [Building forms](/guide/form-builder) for more information.
EOF

# Commit the changes
git add .
git commit -m "Update documentation with more details"

echo ""
echo "Test repository created successfully!"
echo ""
echo "Changes between versions:"
echo "- Added 'digital' to description"
echo "- Added new paragraph about email for notifications"
echo "- Updated step 1 to mention organization account"
echo "- Changed 'list' to 'dropdown list'"
echo "- Added step 5: Click Create"
echo "- Updated naming rules (added hyphens, special characters, start with letter)"
echo "- Added new section: Configure the service"
echo ""
echo "To test the diff viewer, run:"
echo "  cd $(dirname "$SCRIPT_DIR")"
echo "  node dist/server.js \"$TEST_REPO/_index.nb.md\" \"$TEST_REPO/_index.en.md\""
echo ""
