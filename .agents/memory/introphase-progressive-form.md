---
name: IntroPhase progressive-reveal form gating
description: How the CAPADEX assessment intro form's CTA label, formInvalid gate, and field reveal interact — the two traps when adding a new conditional field/persona.
---

The CAPADEX assessment intro (`IntroPhase.tsx`) is a progressive-reveal form: later
fields (concern, consent, email) only render after earlier ones are satisfied. Two
separate mechanisms govern it and they are NOT interchangeable:

- `formInvalid` is an **OR of all `missingX` flags** — order is irrelevant; it just
  decides whether Start is blocked.
- The **CTA button label is an ordered cascade** of the same conditions — order IS
  significant; it tells the user the single next thing to do.

**Rule:** when you add a new conditional field, the CTA label branch for it must be
placed to mirror the *visual reveal order*, not just appended. A field that only
renders after step N must have its label branch positioned after step N's branch —
otherwise the CTA can instruct the user to do something whose UI isn't on screen yet
(e.g. "complete guardian consent" before the consent block, which is gated by
`concernReady`, is even visible).

**Why:** formInvalid still correctly blocks Start, so the bug is silent in logic but
shows as a mismatched/confusing CTA label. A reviewer flagged exactly this.

**Sentinel trap:** anonymity sets `participantName='Anonymous'` as a placeholder that
passes the `length>=2` name gate. Any such sentinel must be cleared on the
persona/context-reset effect (`setParticipantName(p => p==='Anonymous' ? '' : p)`),
or it leaks into a later non-anonymous flow as a fake "real" name.

**Focus-mode persona picker:** the persona picker (4 macro-tracks × sub-personas)
must hide the OTHER tracks once a sub-persona is selected — showing all cohorts
after selection is pure cognitive load (a student keeps seeing "Working
professionals"). Pattern: a `changingPersona` flag + derived `showAllTracks =
!hasSelection || changingPersona` filters `visibleTracks`; selecting resets the
flag (re-lock), and a persistent "Change who this is for" escape hatch re-opens
the full list so the user can never be trapped. Persona-agnostic by design.

**Concern selection has THREE add paths — keep them in lockstep:** the concern
typeahead adds a concern (with its `concernMetaMap` metadata) via (1) dropdown
row click, (2) ontology preview pill, and (3) Enter-key on the top suggestion.
Any new per-concern field threaded into `addConcern`'s meta (e.g. growth_trend,
severity) MUST be added to all three call sites + `ontologyPreview.meta`, or the
field silently goes missing for whichever path you forgot (a reviewer caught the
Enter path being skipped). The selected-concern meta strip degrades gracefully
(renders nothing) when meta is absent, so free-text concerns are fine.
