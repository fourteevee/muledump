# ST Set Collection

The ST Set Collection tracker shows how much of the game's ST (set tier) gear you own.

Open it from **Totals → ST Set Collection** to see every loaded account combined, or from an account's menu (click the account name) to see just that account.

## What counts as owned

An item counts if it is anywhere on the account: equipped, in inventory or backpack, in the vault, gift chest, potion or material storage, quickslots, or held by a pet. Disabled accounts are skipped. If you have just changed your items in game, reload the accounts first.

## Reading the tracker

- The summary at the top shows complete sets, pieces owned, sets started, and how many full sets you could build from what you own.
- Each set shows its pieces. Owned pieces are bright, with the number you own; missing pieces are greyed out.
- `3 / 4` means you own 3 of the 4 pieces. `(×2)` means you own enough pieces for 2 complete copies.
- Click a piece to highlight the accounts holding it on the main page (click-and-find).

## Filters

- **Show:** all sets, complete, incomplete, missing 1 piece, started, or not started.
- **Class:** limit the list to one class.
- **Include legacy sets:** legacy sets are the older versions of some ST sets. Untick this to leave them out of the list and the summary.

## Updating the set list

The set list lives in `lib/stsets.js`. When new ST sets are added to the game, regenerate it from the client data:

```
python tools/datagen/build_stsets.py <gamedata dir> lib/stsets.js
```
