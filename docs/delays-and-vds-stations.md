# DMS delays vs VDS checkpoints (Lions Gate ATIS)

The public page mixes three different ideas:

1. **DMS** — one sign message for the whole corridor (e.g. “LIONS GATE DELAYS 10 MIN”). It does **not** say which side of the bridge or which direction is slow.
2. **ATC** — intersection / controller metadata (IDs 101–105).
3. **VDS** — Vehicle Detection Stations: per-lane loops and “Last Averaged Lane Data” at a **single cross-section** each.

Our app parses **DMS** for the headline delay number and **VDS** blocks for speeds and occupancy. Lane numbers are **local to each VDS** — “Lane 1” at 103 is not the same road position as “Lane 1” at 102.

## Station geography (SB / NB pairs)

| ATC / VDS | Rough location | Role in the app |
|-----------|----------------|-----------------|
| **101 / 201** | South end of causeway, ATIS-01 (“south end of causeway”) | **Foreshore / park / downtown approach** — SB traffic toward downtown, before or at the Stanley Park end. Good for “how bad is it **into** downtown on the SB approach?” vs the merge. |
| **102 / 202** | North end of causeway, ATIS-02 | **Bridge deck** — primary UI lanes (reversible L1 + default L2) for SB and NB. |
| **103 / 203** | South of Marine, ATIS-03 | **Wide merge** — many lanes; SB merge (103) vs NB (203). Strong signal for **queue on the North Shore side** before the bridge when SB merge speeds are very low but the bridge deck (102) is still moving. |
| **104, 105, …** | Marine / Tayler Way, etc. | Not wired into directional delay v1; possible future hints (e.g. Marine eastbound). |

## Directional delay inference (heuristic)

The MOT does not publish “delay is NB-only” vs “SB-only”. We **guess** using relative speeds:

- **North Shore merge queue** (`north_shore_merge`): VDS **103** SB shows **stall-level** speeds (≈12 km/h or less on at least one lane), while **102** SB deck speeds are **much higher** (e.g. ≥12 km/h faster than the worst merge lane), and **101** is not clearly worse than the merge. Then the DMS delay is likely dominated by the **SB queue from the North Shore** — commuters **from West / North Van toward downtown** care most; drivers **from downtown toward the North Shore (NB)** may not be in that queue, so we **hide** the big DMS delay banner for the **Downtown → North Shore** perspective when this pattern is confident.

- **Downtown / foreshore queue** (`downtown_foreshore`): **101** SB is **stalling** while **103** is **not** the worst segment (merge moving better than the park end). Then congestion may be **past the bridge on the SB approach** — still mostly relevant to **SB** commuters; NB perspective is suppressed the same way when we infer a **directional** SB-only pattern.

- **Unknown / both** (`both_or_unknown`): Missing VDS sections, ambiguous speeds, or no clear split — we **show** the DMS delay to **all** perspectives.

Constants live in `packages/core/src/presentation/delay-direction.ts` (`STALL_SPEED_KMH`, gaps). Tune with real drives and false-positive reports.

## Other extractable delay-related signals

- **Previous DMS message** vs current — trend (↑ / ↓ / flat) is already parsed.
- **Counterflow** warnings on L1 — lane state, not delay minutes.
- **Staleness** — `Last Update` vs client fetch time.
- **Per-lane occupancy** — queue density; used for green tinting, not delay minutes.
- **NB merge (203)** vs **202** — symmetric “queue on NB approach” inference is **not** implemented in v1; would mirror 103 vs 102 for **downtown → North Shore** users.

## References

- BC MOT ATIS page (HTML source for the parser): `https://www.th.gov.bc.ca/ATIS/lgcws/private_status.htm`
