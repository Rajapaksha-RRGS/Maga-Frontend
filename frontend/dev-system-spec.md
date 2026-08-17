# Dev System Spec

## Section 7 — UI/UX Decisions

### Design System Reference

All new components **must** read `frontend/design-system.json` before styling
anything. The file is the single source of truth for every color, spacing
value, border-radius, font-weight, and component pattern used in this app.

**Rules:**

1. **No new tokens.** Any new color, spacing, or radius value that does not
   already appear in `design-system.json` must be treated as a **bug**, not a
   new design option. If a genuinely new token is needed, add it to
   `design-system.json` first, document the rationale, and get approval before
   using it in a component.

2. **Consistency enforcement.** When building a new screen or component,
   reference the `component_dna` section for the canonical styling of buttons,
   inputs, cards, chips, and rows. Do not reinvent these patterns — compose
   from the existing DNA.

3. **Accent discipline.** Blue-700 (`#1d4ed8`) is the sole interactive accent.
   It must not appear in body text, headings, or decorative elements. Green and
   amber are strictly semantic (success / warning) — never decorative.

4. **Typography guard-rails.** Only font-weights 400 and 500 are used. If a
   design mock shows bold (600+), translate it to 500 (medium). Labels use
   sentence case or uppercase-xs — never Title Case.

5. **Accessibility minimums.** Every tappable element must be ≥ 44px tall
   (`min-h-[44px]`), must have a `focus-visible:ring-2 ring-blue-600` ring,
   and must include `transition-colors` for press feedback.
