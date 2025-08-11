### Retningslinjer for språk og stil

Bruk rådene og prinsippene fra [Klarspråk hos Språkrådet](https://sprakradet.no/klarsprak/). 

> La eventuelle kodeeksempler stå.

Vi bruker Diátaxis-modellen ([diataxis.fr](https://diataxis.fr/)) og våre egne retningslinjer (se nedenfor).

---

#### Språk

1. Vi skriver først og fremst på **norsk bokmål**.  
2. Alle sider skal **oversettes til engelsk**.  
3. Vi skriver i **konservativ form** (f.eks. `listen` og `hentet` i stedet for `lista` og `henta`).  
4. Referanser til GUI-elementer beskrives med **fet skrift**. Eksempelvis: **Klikk på Lagre og lukk**.  
   * Bruk **«Klikk»** for musehandlinger og **«Trykk»** for tastaturhandlinger.  
   * Bruk **«Velg»** i lister der det finnes flere valg.  
5. Bruk **infinitiv** i hovedoverskrifter og **imperativ** i underoverskrifter i guider og innføringer.  
   * Eksempel:  
     * Hovedoverskrift: `Opprette tjenesten`  
     * Underoverskrift: `Opprett ny tjeneste`  
6. Ved bruk av URL-er i veiledning:  
   * Legg inn et **mykt linjeskift før adressen**, slik at den starter på ny linje.  
   * Dette hindrer at URL-en går utenfor siderammen.  

---

#### Dokumentstruktur – Diátaxis

Følg Diátaxis som standard for dokumenttyper og struktur.

Jobb frem gode eksempler og/eller maler for hver dokumenttype. Beskriv og skill tydelig mellom de fire typene:

##### Innføring (Tutorial)

* Leseren er i **læringsmodus**.  
* Behov: Trinnvis veileder for å lære én eller flere deler av løsningen.  
* Læring skjer underveis gjennom utføring og visning av sluttresultat.

##### Guide (How-to guide)

* Leseren er i **arbeidsmodus**.  
* Behov: Løsning på en konkret oppgave, f.eks. `Hvordan rulle ut ny versjon av Altinn Studio`.  
* Skal **ikke** inneholde dype forklaringer.

##### Forklaring (Explanation)

* Gir **forklaring** på et konsept eller tema.  
* Øker forståelsen og presenteres ofte som artikkel.  
* Kan leses frittstående, f.eks. på toget hjem.

##### Referanse (Reference)

* Gir **oversikt over egenskaper og funksjonalitet** i en komponent eller funksjon.  
* Leseren leter etter detaljert dokumentasjon.

---

### Arbeidsflyt for Oversettelse: Norsk ↔ Engelsk

Dette dokumentet beskriver en 3-faset arbeidsflyt for profesjonell oversettelse, med fokus på kvalitetssikring gjennom hele prosessen. Kan brukes for både norsk-til-engelsk og engelsk-til-norsk oversettelser.

#### Fase 1: Språkvask av Kildetekst

**Mål:** Sikre at kildeteksten er klar, konsistent, grammatisk korrekt og idiomatisk før oversettelse. Dette minimerer misforståelser og feil i den påfølgende oversettelsen.

##### Prosess

1.  Bruk `technical-writer`-agenten for å forfatte første versjon av den tekniske dokumentasjonen
2.  **Gjennomgang av Kildetekst:** Bruk `copywriter-norsk`-agenten for går gjennom teksten for å:
    *   Korrigere grammatiske feil, stavefeil og tegnsetting.
    *   Forbedre setningsstruktur og flyt.
    *   Sikre konsistent terminologi (spesielt viktig for teknisk dokumentasjon).
    *   Fjerne tvetydigheter eller uklare formuleringer.
    *   Tilpasse tonen og stilen til målgruppen og formålet med teksten.
3.  **Klargjøring for Oversettelse:** Eventuelle spesifikke instruksjoner eller kontekst for oversetteren noteres.

#### Fase 2: Oversettelse til Målspråk

**Mål:** Produsere en nøyaktig, flytende og idiomatisk oversettelse som formidler budskapet fra kildeteksten effektivt.

1.  **Oversettelse:** Bruk `copywriter-english`-agenten for å oversette den språkvaskede norske teksten.
    *   Fokus på nøyaktighet og bevaring av mening.
    *   Tilpasning til engelsk idiomatikk og kulturelle nyanser.
    *   Bruk av godkjent terminologi (fra ordlister/terminologibaser).
    *   Opprettholde konsistent stil og tone.
2.  **Bruk av Hjelpemidler:** Oversetteren benytter seg av relevante ordlister, terminologibaser og stilguider.

#### Fase 3: Integrasjon og Verifikasjon

**Mål:** Sikre at den oversatte teksten fungerer som tiltenkt i konteksten den skal brukes.

1.  **Integrasjon:** Den oversatte teksten implementeres i det endelige formatet (f.eks. nettside, dokumentasjonssystem).
2.  **Kontekstuell Gjennomgang:** En siste gjennomgang av teksten i dens endelige kontekst for å fange opp eventuelle layoutproblemer, manglende oversettelser eller andre feil som kun blir synlige i den endelige presentasjonen.
