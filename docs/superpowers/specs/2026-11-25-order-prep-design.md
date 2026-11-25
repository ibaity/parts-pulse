# Order preparation: faster manual adds + "at minimum = short"

## Intent
Make preparing the next purchase order fast: see the shortages and add the extra parts by hand
in the same place. No tracking after the order is sent (explicit non-goal).

## Goals
- Add manual items directly from the **Stock Status** tab (where the order is reviewed), not only from New Analysis.
- Add many items at once by pasting lines `code  qty` (from Excel / email).
- Adding a code that is already on the manual list adds to its quantity instead of creating a duplicate row.
- Stock **equal to** the minimum counts as a shortage (decided by the user).
- Clear the manual list in one action after the order is sent, so the next order starts empty.
- Stop saving the manual quantity to the database on every keystroke.

## Non-goals / anti-goals
- No "ordered / in transit / received" tracking.
- No new order page or order-draft entity (would duplicate the Stock Status table).
- No target stock level / pack size yet (deferred until the user tries this).
- Engineer stock stays excluded from the count.
- Anti-goal: parts with minimum 0 must NOT become shortages (0 ≤ 0) — the new rule only applies when minimum > 0.

## Approaches considered
- **A. Quick-add bar inside Stock Status + bulk paste + merge duplicates + clear list** — chosen: one page, highest value, small change.
- B. A + target stock level — deferred; needs a new field and changes the numbers the user knows.
- C. Separate "Prepare Order" page — rejected; duplicates Stock Status and adds a step.

## Design
1. **Shortage rule** (`src/lib/analysisUtils.js` `stockResult`, `src/pages/Analysis.jsx` `withMinimum`):
   `needsPurchase = min > 0 && current <= min`. Status: `critical` when current ≤ 0, else `low`.
   Manual "stock is enough" hint (`ResultsTable.jsx` `stockIsEnough`) becomes `current > min`.
   Saved analyses keep their old status until re-run; the user re-runs the latest report once (existing Re-run button).
2. **Suggested quantity when stock = minimum**: `min − current` would be 0. Rule: see "Open question".
3. **Quick-add bar in Stock Status**: reuse the code lookup of `ManualOrderPanel` (exact part key, then partial)
   as a compact bar above the Stock Status table; Enter adds; live preview of description + price.
   Shown also when there is no analysis yet. The New Analysis tab keeps its panel.
4. **Bulk paste**: a "Paste list" dialog. Each line = code + optional quantity (tab, comma or spaces; default 1).
   Preview shows found / not found / already on list (qty will be added); not-found lines can be added as custom items
   (code only, no price) or skipped. One click adds all.
5. **Merge duplicates**: on any add, if the part key (`catalogCodeKey`) is already on the manual list, update its quantity
   (old + new) instead of creating a row.
6. **Clear order**: "Clear manual items" button in Stock Status with confirmation; deletes all manual items of the vendor.
7. **Quantity edit**: `ManualOrderPanel` table saves on blur/Enter (like `NumberEditor`), not on each keystroke,
   and updates local state instead of reloading the whole list.
8. Manual list load limit 200 → load all (`fetchAll`).

## Open question (user)
Suggested quantity for a part whose stock equals its minimum.

## Left to the builder
Exact layout of the bar/dialog, toast wording, splitting helpers into `src/lib`.
