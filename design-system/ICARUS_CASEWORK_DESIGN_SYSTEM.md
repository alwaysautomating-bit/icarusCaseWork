# ICARUS CASEWORK — DESIGN SYSTEM
Component Specimen Sheet · Rev 01

Every conclusion traces back to a source. This system catalogues the
components in use across Trial Index, Court Record, Accounts, Questions,
and Incident-to-Warrant, and standardizes patterns where screens disagreed.

Implementation: tokens live in `src/app/globals.css` (`:root`); shared primitives and
normalization live in `src/app/design-system.css`; React primitives in `src/app/casework-ui.tsx`;
fonts are loaded in `src/app/layout.tsx`.

## 01 — Foundations: color
| Name | Hex | Use |
|---|---|---|
| Charcoal / Ink | #1E1712 | |
| Cream / Paper | #FAF7F1 | |
| Ivory (raised) | #F3EEE4 | |
| White | #FFFFFF | |
| Gold-Ochre / Brass | #B08D57 | Chrome, accents, links, verified-adjacent marks. |
| Amber (deeper) | #8B5A2E | Stronger emphasis where brass reads too light. |
| Crimson | #6B1F2A | Discrepancies, contradictions, unresolved risk. |
| Aegean Blue | #3B5566 | Reserved — system & device provenance (not yet applied). |

## 02 — Typography
- Fraunces (serif) — Headings & names
- Public Sans (sans) — Body copy & UI
- IBM Plex Mono (mono) — Data, identifiers, timestamps, labels/eyebrows

The design-component build uses the straighter pairing, same roles: **Playfair Display / Inter / JetBrains Mono**.
**The app ships the straighter pairing.**

## 03 — Surfaces & app shell
Left icon rail (56px, charcoal background), active item filled crimson/maroon.
Case caption bar: "Active case · owner" label + case name + UUID, right-aligned.
Primary nav: underline-active tabs, no fill, disabled items at 50% opacity.

## 04 — Controls
Search input + full-width dark "Search record" button.
Tab row: underline-active, transparent otherwise, matches primary nav style.

## 05 — Signals & status
Question resolution states (dot + label):
- Resolved — solid dot, deep green
- Partially resolved — solid dot, sage
- Contradicted — solid dot, crimson
- Record insufficient — dotted outline, gray
- Unresolved — hollow square, ochre

Source-distance tags (square marker + label):
- Personally observed — filled, ink
- Heard directly — filled, ochre
- Relayed — filled, gray
- From record — outline, gray

Flag chip: crimson outline, "Discrepancy" — used wherever two accounts conflict.

## 06 — Provenance & metadata
KV rows on dark panels: label left (mono, muted), value right (serif for names/status, mono for identifiers/hashes).
Source/open-link pattern: mono locator left, same-weight "Open source →" link right — never buried in a menu.

## 07 — Transcript segments
Selected segment: tinted background + left accent bar (brass). Unselected: hairline top border, no fill.
Window gap: centered mono ellipsis note ("···N more segments in window···").
Each segment: timestamp + ordinal, speaker (serif), text, UUID + "Open segment →" link.

## 08 — Evidence & digital records
Inspector passage: italic serif quote on dark panel.
Digital system-log entry: mono label with outline marker, dark panel.
Small stat/entry card: light panel, mono value, label above.

## 09 — Timeline primitives
Vertical spine with dated rows; dot color signals actor type: ink = witness account / response; brass = investigative / legal action.
Callouts nest under a timeline row for flags (crimson) or provenance chains (sage), left-accent-bar style.

## 10 — Cards & callouts
Research clerk card: dark maroon panel, italic prompt quote, query input.
Case-files side card: dark header with folder count, light rows below.
Shared-event cluster: initials avatar + description, thin ink border.

## 11 — Indexes & lists
Flag list item / responder list item: light raised panel, left accent bar, status chip or dot beneath.
Overview strip: inline stat group (big serif number + small mono label).

## 12 — Empty, loading & error states
Empty: dashed border, centered muted text. Loading: small spinner + mono "Loading…" text.
Error: crimson border + tinted background, bold label + explanation.

## 13 — Density variants
Roomy (default): 16px vertical padding, 14px body text. Compact: 7px vertical padding, 12px body text.

## Notes
This is a specimen sheet, not a redesign — patterns are extracted and standardized from screens already in production.
Where two screens disagreed on a treatment, this sheet picks one and both screens should converge to it over time.
