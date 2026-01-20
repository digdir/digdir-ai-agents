---
title: Feilkoder
linktitle: Feilkoder
description: Referanse for feilkoder i Altinn Notifications API
weight: 20
toc: true
---

Denne siden beskriver feilkodene som Altinn Notifications API returnerer.

## Oversikt over feilkoder

| Feilkode | Beskrivelse | HTTP-status |
|----------|-------------|-------------|
| `NOT-00001` | Manglende kontaktinformasjon | 422 |
| `NOT-00002` | Forespørsel avbrutt av klient | 499 |
| `NOT-00003` | Forsendelse ikke funnet | 404 |

## Feilkodeformat

Feilkodene har formatet `NOT-XXXXX` der `NOT` står for Notifications og `XXXXX` er et femsifret nummer.

Feilkodene returneres i `code`-feltet i responsen. Dette feltet er en utvidelse som er definert i [RFC 7807](https://tools.ietf.org/html/rfc7807) (Problem Details for HTTP APIs).

### Responsformat

API-et returnerer feilresponser i `AltinnProblemDetails`-formatet:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Missing contact information for recipient(s)",
  "code": "NOT-00001",
  "traceId": "00-1f4fe102c1726625cc8b1aec92eb029b-5e652ca2240833c0-01"
}
```

**Feltbeskrivelser:**
| Felt | Beskrivelse |
|------|-------------|
| `type` | URI som identifiserer feiltypen |
| `title` | Kort beskrivelse av feiltypen |
| `status` | HTTP-statuskoden |
| `detail` | Detaljert beskrivelse av feilen |
| `code` | Altinn-spesifikk feilkode |
| `traceId` | Sporings-ID for feilsøking |

## Feilkoder

### NOT-00001: Manglende kontaktinformasjon

**HTTP-statuskode:** 422 Unprocessable Entity

**Beskrivelse:** Én eller flere mottakere mangler kontaktinformasjon i Altinn.

**Vanlige årsaker:**
- Mottakeren har ikke registrert e-postadresse eller telefonnummer
- Kontaktinformasjonen er ikke gyldig eller verifisert
- Organisasjonen har ikke registrert kontaktopplysninger

**Berørte endepunkter:**
- `POST /future/orders` - Oppretting av varslingsordrer med mottakeroppslag

**Eksempelrespons:**
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Missing contact information for recipient(s)",
  "code": "NOT-00001",
  "traceId": "00-1f4fe102c1726625cc8b1aec92eb029b-5e652ca2240833c0-01"
}
```

**Løsning:**
- Kontroller at mottakerens fødselsnummer eller organisasjonsnummer er riktig
- Be mottakeren registrere kontaktinformasjon i Altinn
- Bruk `emailAddress`- eller `phoneNumber`-feltene direkte i stedet for mottakeroppslag

---

### NOT-00002: Forespørsel avbrutt av klient

**HTTP-statuskode:** 499 Client Closed Request

**Beskrivelse:** Klienten koblet fra før serveren fullførte behandlingen. HTTP-statuskode 499 er ikke en del av standarden, og betyr at klienten lukket tilkoblingen for tidlig.

**Vanlige årsaker:**
- Timeout på klientsiden
- Nettverkstilkoblingen ble avbrutt
- Brukeren avbrøt operasjonen
- Applikasjonen avsluttet HTTP-forespørselen

**Berørte endepunkter:**
- Alle API-endepunkter

**Eksempelrespons:**
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Client Closed Request",
  "status": 499,
  "detail": "The client disconnected or cancelled the request before the server could complete processing",
  "code": "NOT-00002",
  "traceId": "00-7174e08c4ffc9ffb0a12a0e42d6ad83b-cf3e698f3c9a5de3-01"
}
```

**Løsning:**
- Øk timeout-innstillingen i HTTP-klienten
- Kontroller nettverkstilkobling og stabilitet
- Implementer logikk for automatisk gjentakelse med samme `idempotencyId`
- Kontakt Altinn support hvis problemet vedvarer

{{% notice info %}}
Denne feilen er ikke forventet under normal drift. Den betyr at klienten ikke lenger har en aktiv tilkobling og kan ikke motta responsen.
{{% /notice %}}

---

### NOT-00003: Forsendelse ikke funnet

**HTTP-statuskode:** 404 Not Found

**Beskrivelse:** Forsendelsen (varslingsordren) ble ikke funnet. Dette kan skyldes at forsendelses-ID-en ikke eksisterer eller at organisasjonen ikke har tilgang.

**Vanlige årsaker:**
- Forsendelses-ID-en (GUID) eksisterer ikke
- Forsendelsen tilhører en annen organisasjon
- Forsendelses-ID-en er feilformatert
- Forsendelsen ble opprettet i et annet miljø (test vs. produksjon)

**Berørte endepunkter:**
- `GET /future/shipment/{id}` - Henting av leveringsmanifest

**Eksempelrespons:**
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Not Found",
  "status": 404,
  "detail": "Shipment not found",
  "code": "NOT-00003",
  "traceId": "00-a1b2c3d4e5f6g7h8i9j0k1l2-m3n4o5p6q7r8s9t0-01"
}
```

**Løsning:**
- Kontroller at forsendelses-ID-en er korrekt formatert som GUID
- Bekreft at du bruker riktig miljø (test eller produksjon)
- Kontroller at organisasjonen har tilgang til forsendelsen
- Kontroller at forsendelsen er opprettet før du prøver å hente den

---

## HTTP-statuskoder

API-et returnerer følgende HTTP-statuskoder:

| Statuskode | Beskrivelse |
|------------|-------------|
| `200 OK` | Forespørselen var vellykket |
| `201 Created` | Ressursen ble opprettet |
| `202 Accepted` | Forespørselen er mottatt og vil bli behandlet |
| `400 Bad Request` | Forespørselen er feilformatert eller inneholder ugyldige data |
| `401 Unauthorized` | Autentisering er påkrevd eller har feilet |
| `403 Forbidden` | Organisasjonen har ikke tilgang til ressursen |
| `404 Not Found` | Ressursen ble ikke funnet |
| `409 Conflict` | Konflikt med eksisterende ressurs |
| `422 Unprocessable Entity` | Forespørselen er gyldig, men kan ikke behandles |

## Relaterte ressurser

- [Veiledning for umiddelbare varsler](/nb/notifications/guides/instant-notifications/)
- [Altinn Notifications API-referanse](/nb/notifications/reference/api/)
- [OpenAPI-spesifikasjon](/nb/notifications/reference/openapi/)
