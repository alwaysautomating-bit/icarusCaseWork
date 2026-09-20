# Ontology pointer

The contract is `contracts/medical-assertion-1.0.md`; the schemas are `contracts/medical-assertion.schema.json` and `contracts/medical-relationship.schema.json`. They are generated from `scripts/medical-assertions-lib.mjs`, which is the single source of truth. Change the library, then regenerate the schemas with `pnpm medical:schemas`.

Three clocks: effective time (only this places an item on the patient's medical history), documentation time, and testimony time.

Assertion-state axes (adapted from the ConText and ShARe/SHARPn model used by the clinical-note-extract skill): presence and hedging live in `status`, timing in `temporality`, and whose finding it is in `experiencer`.

| source wording | status | temporality |
|---|---|---|
| "Denies chest pain" | negated | current |
| "I believe it was" | uncertain | current |
| "We discussed starting X" | asserted (action `discuss`) | hypothetical |
| "She had tried Prozac in nursing school" | asserted | historical |
| "Then increasing to 50 milligrams" (a prescription's schedule) | asserted | hypothetical |
