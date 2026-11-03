---
'@pvotly/web': minor
---

Conditional formatting dialog: edit existing rules in place, reset the form (and focus its first input) after adding or updating a rule, and a single-row rule-creation panel with a primary "Add rule" button. Values are now validated instead of silently becoming `0`, rule descriptions are localized and show measure captions, and `isTrue` / `isFalse` rules can be created and edited. New `UIStrings` keys: `opIsTrue`, `opIsFalse`, `conditionAnd`, `editRule`, `updateRule`, `cancelEdit`. Primary buttons also keep their accent background on hover.
