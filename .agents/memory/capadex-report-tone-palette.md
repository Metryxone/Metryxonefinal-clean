---
name: CAPADEX assessment report tone & palette
description: Why the Clarity Report Preview uses a light, hopeful navy→teal palette (not the old near-black canon) and the contrast floor that must hold
---

# Clarity Report Preview — hopeful light palette

The pre-payment **Clarity Report Preview** (`CapadexBridgePhase.tsx`, the `preview`
step) was deliberately lightened away from a near-black canon (`#0F172A`/`#0B1F3A`
headers + a full dark `#0B1F3A→#1E3560` "dimensional mapping" card) into a light,
hopeful navy(`#344E86`)→teal(`#4ECDC4`) palette: light pipeline header, light
dimensional-mapping card (slate/navy text, navy→teal bars), navy→teal CTA.

**Why:** a real user (a person taking the assessment to get help for a *problem*)
reported the report felt "very fancy, not giving any hope" and "colour combinations
are very dark." For a help-seeking/therapeutic surface, near-black reads as heavy,
clinical, and hopeless — the opposite of the encouraging copy it wraps.

**How to apply:**
- Do NOT "restore" the near-black header/cards "for consistency with the dark canon."
  `replit.md` still mentions a shared visual canon, but the heavy near-black blocks
  were the specific thing the user rejected. The shared canon that still holds is the
  *structure + tokens* (border `#E8EBF4`, navy `#344E86`, teal accents, `rounded-xl`,
  `text-[11px] font-black uppercase tracking-widest` headers) — not a dark background.
- The full paid report (`CapadexReportPhase.tsx`) was already light (whites/greens),
  so no dark-block divergence exists between the two screens after this change.
- **Contrast floor (a reviewer will catch violations):** bright teal `#4ECDC4` is too
  light to carry white or light-blue text. Header + CTA gradients must stay
  navy-dominant and only *end* in a deeper teal (e.g. CTA ends `#14857E`, header ends
  `#4670AC`) so centered white button text and the light-blue (`#93C5FD`) stage-tracker
  text keep ~4.5:1. Teal text on a light background must use a darkened teal like
  `#0E7C74`, never raw `#4ECDC4`.
- The `#94A3B8` 9–10px micro-labels ("ready", "/100", stat captions) are the whole
  component's intentional de-emphasized-placeholder pattern; leave them consistent
  rather than darkening only a few.
