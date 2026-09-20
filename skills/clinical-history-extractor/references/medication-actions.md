# Choosing action, act, report, and basis

`action` says what change the statement describes. `act` or `report` says who is making the claim.

| the source says | action | act / report | basis |
|---|---|---|---|
| "I prescribed sertraline 25 mg" | start | act `prescribed` | firsthand_provider |
| "I recommended sertraline" | start | act `recommended` | firsthand_provider |
| "I told her to stop it" | discontinue | act `instructed` | firsthand_provider |
| "we decided to taper by 0.25 mg every two weeks" | taper (with from and to) | act `advised` | firsthand_provider |
| "we discussed Lamotrigine" | discuss | act `discussed`, temporality hypothetical | firsthand_provider |
| "she said she decided not to take it" | (none) | report `patient_reported_not_taking` | patient_statement_to_witness |
| "she said she increased the dose the night before" | increase | report `patient_reported_taking` | patient_statement_to_witness |
| "she was taking 200 mg" (another provider's drug) | (none) | report `patient_reported_taking` | patient_statement_to_witness |
| "there was a plan to increase it" (another provider's plan) | increase | report `third_party_reported`, temporality hypothetical | third_party_report |
| counsel: "Take 25 for a week, then 50?" witness: "Yes." | as stated | as the witness confirms | counsel_proposition_affirmed |

A statement that a medication was on a list, was prescribed, was dispensed, or was taken are four separate assertions. If the source supports only one, record only one.

A dose belongs on the assertion only when a cited segment states it for that event. If the dose comes from a different segment, cite both segments and say so in `note`.
