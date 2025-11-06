# Explanation Documentation Template

Use this template for all explanation-type documentation in the Diátaxis framework.

## Norwegian Template (`_index.nb.md`)

```markdown
---
title: [Norsk tittel]
description: "[Klar, konsis beskrivelse på norsk]"
linktitle: [Kort menytittel]
tags: [relevante, tags]
weight: XX
---

## Introduksjon

[Forklaring av hva denne siden handler om og hvorfor det er viktig å forstå emnet]

## [Hovedseksjon 1]

[Innhold med forklaringer]

{{% notice warning %}}
**Viktig informasjon som brukerne må være klar over**
{{% /notice %}}

### [Underseksjon]

[Detaljert informasjon]

## [Hovedseksjon 2]

[Mer innhold]

### [Underseksjon]

[Ytterligere detaljer]

{{% notice info %}}
**Nyttig tilleggsinformasjon**
{{% /notice %}}
```

## English Template (`_index.en.md`)

```markdown
---
title: [English title - identical structure to Norwegian]
description: "[Clear, concise description in English]"
linktitle: [Short menu title]
tags: [relevant, tags]  
weight: XX  # Same weight as Norwegian version
---

## Introduction

[Explanation of what this page covers and why it's important to understand the topic]

## [Main Section 1]

[Content with explanations]

{{% notice warning %}}
**Important information that users must be aware of**
{{% /notice %}}

### [Subsection]

[Detailed information]

## [Main Section 2]

[More content]

### [Subsection]

[Additional details]

{{% notice info %}}
**Useful additional information**
{{% /notice %}}
```

## Critical Checks

**BEFORE submitting:**

1. ✅ **Single front matter** - No duplicates
2. ✅ **"Introduksjon"/"Introduction"** - Always include  
3. ✅ **Identical structure** - Norwegian and English match
4. ✅ **Consistent heading levels** - ## for main, ### for sub
5. ✅ **Compare with similar docs** - Use same patterns
6. ✅ **Test locally** - `hugo server --navigateToChanged`