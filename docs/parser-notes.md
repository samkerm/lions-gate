# Parser notes

## What is parsed directly

- **Last Update**: line matching `Last Update:` from stripped page text.
- **DMS delay**: text between `Current Requested Message` and `Previous Requested Message`, scanning for `NN MIN` or `N HR` tokens.
- **VDS lanes (primary)**: sections `VDS ID: 102` (southbound / toward downtown) and `VDS ID: 202` (northbound / toward north shore) at the **north end of the causeway (ATIS-02)**, configurable via `FeatureFlags.primarySouthCausewayVdsIds` (alternative pair: `101`/`201` at the south end).
- **Per lane**: `Lane Number:` chunks with `Current Upstream Loop Status` and `Current Downstream Loop Status` lines.

## What is inferred

- **Lane health**: worst of upstream/downstream classifications (`OK`, `WARNING` with counterflow closure, `ERROR`, etc.).
- **Bridge mode**: high-level enum (`counterflow_active`, `two_to_downtown_two_to_north_shore`, `partial_or_degraded`, `unknown`) from lane health counts.
- **Stale state**: compares parsed Last Update timestamp to the client clock using `FeatureFlags.staleAfterMs` (default 10 minutes).

## Assumptions

- Primary bridge deck signal defaults to VDS `102` / `202`; if MOT renumbers sensors, update flags + fixtures.
- DMS delay appears as plain `MIN` / `HR` tokens inside the current requested message block.
- HTML can change layout; parsing is text-first after lightweight tag stripping.

## Failure modes

- Missing Last Update → warning + stale reason `missing_last_update`.
- Missing DMS block → `delay` may be `null` with warning `missing_dms_message`.
- Missing VDS sections → empty lane arrays + `missing_vds` warnings.
- Thrown exceptions inside parsing are caught by `parseAtisHtmlOrWarn` and surfaced as `parse_exception` with `snapshot: null` for service-layer fallback.

## Updating fixtures

1. Save a fresh HTML sample from the live page (respect MOT terms of use / caching policies).
2. Trim to the smallest excerpt that still exercises DMS + the configured primary VDS pair (default `102`/`202`).
3. Add or adjust a file in `packages/core/src/fixtures/`.
4. Update tests if field names or lane ordering changed.
