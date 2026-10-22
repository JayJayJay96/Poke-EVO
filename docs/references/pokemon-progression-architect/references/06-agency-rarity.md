# Player agency, rarity and discovery

## Agency budget (prototype)
3 rerolls/run, 2 banishes/run, 1 augment replacement/run, 1 change of focused skill/run. Focus x2 eligibility weight, only for valid targetable offers. All remaining balances/charges visible. Reroll consumes charge and rerolls within **same draft type**; guarantees persist. Banish excludes normal eligible definition cards for run, but cannot erase essential protected choices or leave empty valid pools. Replacement warns on broken mutation recipe and downstream synergies.

## Rarity
Initial category weights for *eligible augment candidates*: common 50%, uncommon 30%, rare 16%, epic 4%. These are sampling weights, not observed marginal appearance rates after filtering. Rarity reflects complexity/specialization and access, **not linear power** or mandatory build strength. Normal augment rarity may inform candidate weights, but named mutation availability comes from recipe eligibility and choice, not a legendary roll.

## Build intent
Use broad tags (infection, mobile, stationary, charged-burst, summons, healing-conversion), generated from equipped effects, to slightly increase **relevance** weight (e.g. x1.25), capped with other multipliers. Do not force a fixed preset build. Post-discovery journal reveals compatible combinations and potential costs; pre-discovery journal gives thematic hints only.

## UI contract
Card preview: move, current behavior, predicted resulting behavior, numerical change if applicable, evolution override text, synergy or mutation hint, cost/trade-off, blocked/unblocked eligibility. Revalidate at commit to prevent asynchronous queued decisions from selecting stale offers.
