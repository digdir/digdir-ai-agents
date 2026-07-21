---
type: log
title: Endringslogg for doc/
description: Append-only kronologi over endringer i repoets kunnskapsbase. Nyeste øverst.
---

# Logg

- **2026-07-21** — M4+M5 gjennomført: ny skill `knowledge-synthesis`
  integrerer innboks-kandidater i OKF-sidene (oppdaterer index/log, flagger
  motsigelser, tømmer innboksen, pusher), og watch-loopen kjører syntesen
  automatisk når innboksen har kandidater og `SYNTHESIS_INTERVAL_HOURS` er
  passert. Verifisert live: agenten opprettet `domains/digdir-ai.md` fra en
  ekte læringskandidat og pushet selv.
- **2026-07-21** — M3 gjennomført: agenten fanger læringer — appender
  kandidater til `inbox/learnings.jsonl` i kunnskapsrepoet og
  committer/pusher selv med bot-identitet (entrypointet konfigurerer
  identitet og retry-pusher ved oppstart). Repo-spesifikke læringer meldes
  i tillegg som issue med label `learning`.
- **2026-07-21** — M2 gjennomført: proxy-agenten kloner/puller
  kunnskapsrepoet (`KB_REPO`/`KB_GH_TOKEN`) til `/knowledge` via
  anker-folderen `workspaces_knowledge/`, ny skill `knowledge-base`,
  kunnskaps-hint i prompten. Kunnskapsrepoet bootstrappet med
  OKF-grunnstruktur.
- **2026-07-21** — Opprettet `doc/` med OKF-konvensjoner; la inn plan for
  kunnskaps- og læringsprosessen ([plans/kunnskap-og-laering.md](plans/kunnskap-og-laering.md)).
