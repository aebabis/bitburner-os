# Review Ledger

Status of the systematic review. 144 reviewable files (excludes `home/log`, `home/tmp`, and
`lib/test/data/BN4-mock.ts`). See `Review-Charter.md` for process, `General-Design.md` for context.

Status: `—` not started · `WIP` in review · `✓` reviewed, no open findings · `!` open findings

## Rounds

| Round | Units | Status |
| --- | --- | --- |
| R0 | Architecture | ✓ |
| R1 | 1 | ! reviewed — 17 findings |
| R2 | 2, 3 | ! reviewed — 22 findings |
| R3 | 4, 5 | ! reviewed — 22 findings |
| R4 | 6, 7 | ! reviewed — 23 findings, 3 withdrawn |
| R5 | 8, 9 | ! reviewed — 30 findings |
| R6 | 10, 11, 12 | ! reviewed — 33 findings |
| R7 | 14 | ! reviewed — 17 findings, 1 withdrawn. H1/H2/H3/M2 all closed by the downloader rewrite (82e6ba0, 7eefa47) — unit 13 (`mole.ts`) parked by maintainer: it works well and would need substantial refactoring, so medium-priority items in the core take precedence |
| R8 | 15 | ! reviewed — 2 High, 5 Medium, 15 Low. **Review complete.** |

**Cross-cutting change, R7: RAM allocation redesigned around a single policy.**
H21 exposed a structural fault rather than a bug: `HACKER_POLICY` reserved 16GB on home while
`DEFAULT_POLICY` reserved 4, and only `angel`/`thief` passed the strict one — so `share` and
`stanek` filled home to the 4GB floor and the hacking services, needing 16GB of headroom,
computed home's availability as 0 and dropped it from their pool. Whichever policy was laxer won
by acting first. `getRamAllowances` compounded it by returning 90% + 10% + 10% = **110%** of the
pool, papered over by a "takes from hack RAM as able" comment, and its own TODO admitted
`serviceRam: Infinity` was unsatisfactory ("both approaches suck").

Replaced with one policy and one snapshot:
- **`getHomeReserveRam`** — a single `min(16, max(2.1, (homeRam + pool1Ram) / 10))`, no
  per-script exceptions. It scales with **THREADPOOL-01 specifically**, not cloud servers
  generally: `infect.ts:29` `fullInfect`s only `-01` and the low-level company servers, so only
  those can host services and take load off home. Buying `-02` adds worker capacity alone.
  `highPriority` (love, nerd) bypasses the reserve; corp lost its old exemption as a side effect.
- **`takeSnapshot`** — the planner calls it when about to start `thief`/`angel`, publishing
  `RamPolicySnapshot` to `PORT_RAM_POLICY` (registered below `MAX_RESERVED_PORT`, so
  `boot/reset.ts` clears it). Services are *measured* (`currentServiceRam`) rather than assumed
  infinite, which is the third option the old TODO had not considered. Share is gated on
  `currentWork.type === 'FACTION'`, defaulting **on** when love is not running so an absent
  signal never reads as an explicit zero. Allotments now sum to 100%.
- **`getWorkerRamState`** — returns state (`targetRamUse`, `targetThreads`, `currentWorkers`,
  `currentRamUse`, `unusedRam`), not decisions. Consumers differ in what they *do*, not in what
  they need to know: share grows and shrinks, stanek only grows (correct — its workers
  self-terminate on layout change and RAM only rises within a cycle), thieves place batches.
  Kills were deliberately **not** pushed into it: a query that kills makes its own return value
  stale, and killing a hack thread without its compensating grow/weaken is H9's failure mode.

Closes **H21**, **P16**, and substantially **C9**. Ten review iterations found, among others: an
inverted grow condition that made share thrash; `!!service.isRunning` without the call, silently
making both new flags always true; `!` assertions on `services.find` that would have thrown in
every node without SF13, killing hacking; `ns.getServerMaxRam()` with no argument measuring the
caller's host; and `host === 'home'` where `hostname` was meant — invisible to `tsc` because flow
narrowing does not cross into a callback. **Open:** thieves still discard `allottedBatchRam`
(in BACKLOG), and `stanek.ts` calls `getWorkerRamState` inside a 50ms loop, doing a full network
`ns.ps` scan 20×/sec where share was moved to 10s for the same reason.

**Cross-cutting change, R5→R6: goal-engine time semantics.** `null` removed from the goal
engine entirely. Motivation: `timeToComplete()` overloaded `0` ("done" vs "not done, no deps")
and `null` ("unknown rate" vs "no estimator" vs "unbounded"), so each of ~10 consumers invented
its own policy — five different ones, three of which read unknown as *cheap*. That single
ambiguity produced G2, G4, A2, C8, G8 and forced S7's Netburners gate to exist.

Now: `ownTime`/`timeToComplete` are `() => number`; `UNPRICEABLE` is the finite sentinel;
`neverGoal` covers domain unknowability and `waitGoal` transient missing data; rate parameters
are asserted at construction with callers gating (`totalIncome` in `getGoals`, `repRate` in
`getBladeburnerTree`); `getPlanningHorizon` substitutes — never caps — for arithmetic consumers.
All ten coercions deleted. `labyrinthGoal` and the bladeburner tree gained real estimates
(closing G6), three dead `formulas ? … : null` ternaries and three dead `isRepBound` branches
removed, `assert.throws` added to the test runner, and three invariant tests pin the composition
rules. **Verified in game:** suite green, and `sysadmin`/`hacknet`/`love` behave as expected.
The class is now unrepresentable rather than handled. See the charter's "Goal-engine time
semantics".

**Cross-cutting change, R3→R4.** `StaticData` now groups conditionally-booted fields into
`singularityData?` (data4) and `graftingData?` (data6), with `SF4StaticData`/`SF10StaticData`
narrowed types and `hasSingularityData`/`hasGraftingData` type predicates. Nine functions dropped
their internal guards and declare the requirement in their signature instead; `getGoals` narrows
above plan construction, which also stops ~25 futile `buildFactionGoalTree` calls per invocation
when the tables are absent. Closes B2, B3, and G-class NaN paths by construction. Verified in game:
aug batch selection behaves correctly. See General-Design "Data Stores" for the rules.

**R4 false positives (withdrawn, do not re-report):** unit 6 F2 (`onlineMoneyMade` is 0 for
`angel`/`thief`) — wrong, a dying child's earnings are attributed to a live parent; unit 6 F3
(`eight-gig.ts` cannot hand off) — wrong, `planner.ts` is 4.55GB measured and `ns.run` is the
deliberate choice since eight-gig already pays for it. Both are now in the charter's
"Bitburner runtime facts". Unit 4 W2 (layout ANSI regex) was likewise a false positive — the file
held a literal ESC byte.

**R4 fixes applied:** `angel.ts:427` now guards `putMoneyData` on `totalBatchRam`, removing the
`NaN` that made `sysadmin.ts:104` buy a 4GB server on a fresh node. `nerd.ts:169` disables itself
once `purchase4SMarketDataTixApi()` succeeds, so `nerd` and `trader` can no longer run
concurrently (unit 7 finding 2). Thief changes deferred until a pre-SF5 save is available to test
against — F1 (weaken sized for one hack thread) and F6 (`getWeakenTime()` missing its target) both
need thief to be the active service to observe.

## Unit 1 — Substrate (1206 lines) · reviewed R1

| File | Status | Notes |
| --- | --- | --- |
| `etc/augmentations.ts` | ✓ | |
| `etc/config.ts` | ✓ | |
| `etc/filenames.ts` | ✓ | |
| `etc/ports.ts` | ✓ | |
| `lib/data-store.ts` | ! | F4, F7b |
| `lib/events.ts` | ✓ | Dead file; deferred as open question |
| `lib/in-place.ts` | ! | F2, F3, F6, F16 |
| `lib/ports.ts` | ! | F15 |
| `lib/query-service.ts` | ! | F11 |
| `lib/ram-router.ts` | ✓ | No new findings; evidence added to open question |
| `lib/ram.ts` | ! | F12 |
| `lib/rmi.ts` | ! | F1 |
| `lib/scheduler-delegate.ts` | ! | F5, F13, F14, F17 |
| `lib/service-api.ts` | ! | F8 |
| `lib/service.ts` | ! | F9, F10 |
| `lib/util.ts` | ✓ | Statistics helpers checked against reference formulas |

### R1 findings

Independently verified by the maintainer's agent: F1, F3, F4, F7, F9.

**High**
- **F2 — ACCEPTED, will not fix.** Maintainer: "The RAM yielded on L85 in in-place.ts is used on L93. The error on L88 is never thrown. The only error that is occasionally thrown is L100. While I would be interested in a solution to this, I suspect there is none and am willing to accept this as a drawback of in-place's advantages." The same call covers **F3, F6 and F16**. So the residual restore-failure risk is a known cost of the mechanism, not an open defect. Original: `lib/in-place.ts:83-101` — the `ramOverride` shrink reserves nothing, so freed GB are visible to `ram-router` during the yield and the restore can fail, killing the caller. Worst for the three scripts with zero `homeReserve` (`corp.ts`, `love.ts`, `nerd.ts`) — exactly the heaviest `inPlace` users.
**Medium**
- **F1** `lib/rmi.ts:6-18` — ~~`rmi` ignores `retry = false` when a ticket resolves with `pid === 0`~~ **FIXED, pending manual test.** `pid === 0` now returns `false` on the non-retry path, and the retry path sleeps `RETRY_DELAY` (1s) between attempts instead of re-delegating as fast as the scheduler can reject. `wolf.ts`'s trigger was separately resolved by inlining.
- **F3** `lib/in-place.ts:167,177` — `port` is unvalidated and ~20 call sites pass `ns.pid`. *Revised to low:* PIDs increment monotonically within a session and the boot chain consumes 1-9 before any `temporary` service starts, so a collision with a reserved port is not reachable. Residual: `getPort` (`:142`) draws from `1 + random(MAX_SAFE_INTEGER)` rather than `util.randPort()`'s guarded range.
- **F4** `lib/goals/goals.ts:98,200` — reads `scriptRam['/boot/data4.ts']` with a leading slash; `boot/data1.ts` keys from `ns.ls`, which has none. Produces `NaN` in `homeRamGoal`, an unsatisfiable goal, and `"NaNGB RAM on home"` in the UI.
- **F5 — re-diagnosed R6: the defect is the call site, not `closeTicket`.** `closeTicket` *cannot* fail — `port.clear()` precedes `port.write()` so the write always fits, `NetscriptPort.write` returns the evicted element (never a success boolean), and the wrapper's only throw path (`s(null)`) is unreachable because `responses` is always an object. `return true` is honest. The bug is `planner.ts:48` asking for a signal that cannot exist, and diverging from its own sibling: the exec-failure branch (`:53`) does `droppedTickets++` unconditionally, while the missing-script branch counts only if `closeTicket` fails. Two consequences: a job whose script does not exist is never counted, and a **fire-and-forget job (no ticket) with a missing script is invisible entirely** — `ticket != null` short-circuits before the counter, and those are exactly the jobs with no caller waiting to notice. **FIXED (untested in-game)** — `planner.ts:47-51` now mirrors the sibling. Lint and prettier clean. Expect `droppedTickets` to read higher than before: missing-script jobs, including fire-and-forget ones that previously slipped the `ticket != null` guard, are now counted. Residual: `closeTicket`'s `return true` is now dead — no call site reads it — and is what made this look like a working failure check; worth removing next time that file is touched.
- **F6** `lib/in-place.ts:92-101` — no `try/finally`; throw paths leave the shared port dirty. Because `getPort` memoizes in a module-level map that survives restarts, the next run reads a stale result as its arguments. Silent wrong values.
- **F7** `scripts/check-data-deps.ts:29` — ~~filters for `.js`; the tool scanned zero files and always reported success~~ **FIXED.** Now globs `.ts` (skipping `log`/`tmp`), strips types via `esbuild.transformSync` before `acorn` (acorn cannot parse TS, and the old silent `catch` would have hidden that too), parses once per file rather than once per store, exits non-zero if nothing is found or any file fails to parse, and reports unparseable files instead of swallowing them. (F7b: `MoneyData.totalIncome` is never written — `query-service` recomputes it; `PlayerData.isPlayerUsingTerminal` is neither written nor read.)
  - **F7c — `isCallTo` hard-coded the argument name `ns`.** esbuild renames shadowed bindings, so a nested `(ns) => …` parses as `ns2` and every store access in that file went undetected — reads *and* writes, since `isCallTo` gates both. This produced false orphans (`moneyData.theft`, `playerData.stanekLayout`, both read in `bin/dashboard.ts:318,369`) and would equally have hidden real ones. Fixed by matching any single identifier argument; the accessors take exactly one, so it is unambiguous.
  - Confirmed orphans after the fix: `playerData.hasGift` (`bin/stanek.ts:211`), `staticData.companyFavor` and `staticData.companyPositions` (`boot/data4.ts` — both appear nowhere but their type declaration).
  - Remaining `staticData` output is low-signal: `favorToDonate`, `serverBackdoorRequirements`, `factionRequirements`, `augmentationPrereqs` are all read through a `staticData` *parameter* in `lib/aug-select.ts` and `lib/goals/tree.ts`, which the tool cannot follow. It warns about this. Teaching it to track typed `StaticData` parameters would clear the section — not done.

**Low** — F8 `service-api.ts:41` `override` never read though `usr/services.ts` documents `--force`; F9 `service.ts:114` `toString` resolves to `globalThis.toString`; F10 `service.ts:101` `pendingRam` has no callers; F11 `query-service.ts:34` unreachable `currentNode === 8` disjunct; F12 `ram.ts:100` `packThreads` conflates "no exact packing" with "0 threads"; F13 `scheduler-delegate.ts:23` dead `startTime`/`requestTime`; F14 `:70` try/catch around code that cannot throw; F15 `ports.ts:9` `NaN`/`-Infinity` round-trip to `null`, defeating `= 0` defaults; F16 `in-place.ts:18` `atExit` registered after the awaited call, so a killed helper never writes its port and the parent blocks forever; F17 **(half inaccurate as logged)** the ticket map *is* pruned — `closeTicket:86-87` evicts by `TICKET_TTL`; the other half stands: a full JSON parse *and* stringify of the whole map per exec, on the planner's critical path.

### R1 deletions applied
- **F10** `service.ts` — `pendingRam` removed (no callers; a run-queue leftover). Its `ram` field was **kept**: `bin/dashboard.ts:259` sums `service.ram`, so removing it would have broken the services panel.
- **F13** `scheduler-delegate.ts` — `startTime`/`requestTime` removed from `Job` and `DelegateOptions`. They were the removed run queue's ordering keys; the planner destructures neither and no caller ever set `startTime`.
- **F14** `scheduler-delegate.ts` — try/catch around `tasks.push(...)` on a freshly-flattened array removed.
- **F11** `query-service.ts` — `currentNode === 8` disjunct removed from `usingCorp`; 8 is not in `[3, 10, 12]`, so it could not change the result.
- **S12** `factions.ts` — `MEGACORPORATIONS` removed (exported and imported nowhere).

### Substrate contracts for later units
- `staticData.scriptRam` keys have **no leading slash** (`ns.ls` format). Strip before lookup.
- A single `put*` is race-free (no yield inside), but holding a `get*` across an `await` and writing back is not. `bin/hacknet.ts:13` is safe only by accident.
- `lib/ports.ts:45` clears before serializing, so a `stringify` failure destroys the store.
- `inPlace` ports must exceed `MAX_RESERVED_PORT`; prefer `util.randPort()`, never `ns.pid`.
- The `.rip` bracket-rewrite regex only matches receivers whose identifier starts with `ns`. `$['getServer']` inside a `runInPlace` body is not rewritten and fails.
- Until F1 is fixed, treat every `await rmi(...)` as a potential permanent block.
- `bin/planner.ts:77` `handleExecRequests()` is outside the per-service try/catch; a throw there stops the planner entirely.

## Unit 2 — Goals engine (1054 lines) · reviewed R2

| File | Status | Notes |
| --- | --- | --- |
| `lib/goals/goals.ts` | ! | G1, G2, G5, G7, G9, G10 |
| `lib/goals/nodes.ts` | ✓ | No defect of its own. Constructors pure, `prerequisites` cycle-safe via `seen`, `_ttc` memos are per-object so they cannot leak between calls |
| `lib/goals/tree.ts` | ! | G3, G4, G6, G8. No mutation of any store object; already-joined short-circuit at `:161` correctly implements the doc's prerequisite-removal rule everywhere except the bladeburner tree |

### R2 unit 2 findings

Maintainer-verified: G1, G2.

**FIXED in R2 (G1, G2, G9 — one change).** A new `HORIZON` goal type (`nodes.ts:167`) replaces the no-plan fallback. Rationale: consumers do not ask this tree "when is the next install", they ask "how valuable is money against time" and amortize over whatever horizon they get — `0` claims an install is imminent and stops all spending, `null` amortizes over Infinity, and neither is honest when the answer is unknown. `HORIZON_MS` (30m) was already the de facto ceiling via `angel.ts:234`'s `Math.min(HORIZON_MS, ttc)`, so BN1.1 now behaves exactly as any node whose real tree exceeds 30m. The `goals.ts:199` fallback split three ways: SF4 + no aug data keeps the (now slash-corrected) home-RAM goal, since that is genuinely actionable; no SF4, or aug data present with everything owned, returns `horizonGoal(1800, [augMoneyGoal(money, money, …)])` — money goal satisfied by construction so `angel` reads "no target" rather than an arbitrary one. `hasSF4` now mirrors `boot/boot.ts` (`ownedSF.has(4) || currentNode === 4`), closing G9. The `scriptRam` key is a named `DATA4_SCRIPT` constant. `yarn lint` clean; no test encoded the old behavior. **Untested in-game.**

Maintainer revision: the `!hasNode(4)` case was hoisted to short-circuit ahead of the special-case chain, the SF4 check dropped from the `augmentationNames == null` guard (unreachable below the hoist), and `bootRam` changed from an exact `scriptRam` key to `Math.max` over every `^boot` entry — semantically better, since boot spawns stages sequentially and home must fit the largest one. The all-augs-owned case is **not reachable**: NeuroFlux is purchasable without limit, so at least one accessible faction always yields a batch. The trailing fallback is therefore a `throw`, not a tree.

**High**
- **G1** `goals.ts:98,200` — F4 confirmed. `scriptRam['/boot/data4.ts']` with a leading slash; `boot/data1.ts:43` keys from `ns.ls`, which has none. `undefined → Math.log2 → NaN → 2**Math.ceil(NaN) → NaN`, giving `currentRam >= NaN` (always false) and `"NaNGB RAM on home"`. These are the only 2 of 5 `scriptRam` readers that don't strip the slash. No siblings of this kind elsewhere — every faction/aug key comes from the same enum on both sides.
- **G2** `goals.ts:199-203` — **the no-plan fallback is the engine's permanent output in any BitNode without SF4, and it reports `timeToComplete() === 0`.** Without SF4 `data4` never runs, so `factionAugmentations` is absent, every `findOptimalBatch` returns an empty batch, every `buildFactionGoalTree` returns `null`, and `bestPlan` is `null`. Every node in the resulting chain has `ownTime: () => 0` and its only leaf (`moneyPrereqGoal(homeRamUpgradeCost = 0, …)`) is trivially done. **Verified downstream:** `bin/sysadmin.ts:98` `profit(ram) = 0 * rate * ram - cost` is negative for every size, so `getMinRam()` doubles to `> purchasedServerMaxRam`, returns `null`, and **no purchased server is ever bought**; `bin/hacknet.ts:21` sees `breakEvenTime > 0` for every upgrade and **never buys one**. Reproduces in BN1.1, BN2.1, BN5.1. The branch is also semantically wrong there — it asks for home RAM so `data4` fits, but without SF4 that stage never runs regardless.

**Medium**
- **G3 — FIXED (untested in-game).** `tree.ts:335` now maps every entry of `locationReqs` to a `locationGoal` and wraps them in `eitherGoal` when there is more than one, keeping a bare goal for the single-city case. Verified against the full faction table: 7 factions have a single mandatory city (unchanged behaviour), 3 have OR-sets (Tian Di Hui, Tetrads, The Syndicate), and **none mixes both** — so there is no regression path. love's consumer at `:256-258` already used `some(isDone)`, i.e. OR semantics; it was simply never handed the alternatives, and `prerequisites` walks into `EITHER` deps (`nodes.ts:114-120`) so all branches now surface. Second-order win: `eitherGoal.isDone` being `some(...)` satisfies the join prerequisite when the player is already in an accepted city, so `joinTime` into `findOptimalBatch` no longer overprices those three factions. **Latent, unreachable today:** `locationReqs` (`:245-251`) still merges mandatory `city` requirements with `someCondition` cities; the old `const [loc] =` incidentally protected that case by taking the plain city first. Worth a comment if the game ever adds a faction with both. Original: `tree.ts:174-180,259-260` — a multi-city `someCondition` is collapsed to its first city via `const [loc] = locationReqs`. Tetrads/Tian Di Hui accept Chongqing OR New Tokyo OR Ishima. A player in Ishima gets an unmet "Visit Chongqing" goal and `bin/self/love.ts:233` pays $200k to travel needlessly. The `skills` conditions of a `someCondition` are correctly turned into an `eitherGoal` at `:250`; the city conditions are not.
- **G4 — FIXED.** New `HACKNET` goal type (`nodes.ts`) carrying `{ requirement, stat }`. `bin/pool.ts` publishes per-server `{ level, ram, cores }` to `playerData.hacknet.servers`; `tree.ts`'s `getHacknetGoal` sums those into the three totals, prices each with coarse heuristics — cores: one fresh server per missing core; RAM: one server per 2 missing GB plus one doubling; levels: spread evenly over `targetCores` planned servers — and wraps them in `mutexGoal`, which *sums* its parts' times (upgrades are bought one at a time out of one wallet). The engine is deliberately not optimising: `pool` has the per-server stats and overshoots these targets anyway. Without Formulas.exe the goals are still built with `null` costs, so `isDone()` stays accurate and only the time is unknown. **S7's Netburners gate at `aug-select.ts:293` stays** — in that no-Formulas window `tree.ts:369`'s `?? 0` still collapses an unknown join time to zero. No test coverage for the new goal type yet. Original text: ~~hacknet requirement types are silently dropped. Netburners' join subtree contains only the hacking goal, so `joinTime` is 0 and its utility outranks honestly-modelled factions.
- **G5 — MOSTLY NOT A DEFECT.** Maintainer: the snapshot "is not intended to represent the chosen tree; it's meant to show the best faction *if a faction were chosen*. It was used to troubleshoot aug prioritization." So diverging from an early return is the intent, not a bug — **do not re-report the placement**. Residual: `getGoals` still writes `globalThis.__goalTracker` on every call while General-Design claims "The function is functional; it is designed to be stateless". The diagnostic is worth more than the claim, so the fix is a sentence in the doc, not a code change. Original: `goals.ts:92` — `getGoals` is not side-effect-free: `recordGoalSnapshot` mutates `globalThis.__goalTracker` using `Date.now()`, contradicting the doc's stateless guarantee. Worse, it runs *before* all eight early returns, so the recorded `selectedFaction` can disagree with what `getGoals` actually returns.
- **G6 — FIXED** (maintainer, earlier commit). Original text: ~~bladeburner combat prereqs are never removed after joining (no already-joined short-circuit, unlike `buildJoinSubtree:161`). Combined with Stanek fragment scaling, 3 of 4 `COMBAT_LEVEL` goals are unmet at any moment, and `bin/sleeves.ts:357` puts every sleeve in the gym for the rest of the cycle. Same function: every leaf gets `trainingTime = null`, so the whole tree's `timeToComplete()` is `null`.

**Low** — G7 `goals.ts:136` `hasBlade` tests installed augs only while `:170`/`:174` correctly use the owned union; G8 `tree.ts:272` `isRepBound` treats unknown money time as rep-bound, so with zero income `love.ts` grinds rep forever and income never starts; G9 `goals.ts:97` guard checks `ownedSF.has(4)` but `boot.ts:16` runs data4 on `ownedSF.has(4) || currentNode === 4`; G10 `goals.ts:119` BN3/BN7 karma branch gates on SF3/SF7 level when gang availability is SF2 — a BN1→BN2→BN3 player gets no karma goal and never forms a gang.

## Unit 3 — Scoring inputs (922 lines) · reviewed R2

| File | Status | Notes |
| --- | --- | --- |
| `lib/aug-select.ts` | ! | S1, S2, S3, S4, S6, S7, S8, S9. Highest-defect file in the unit: the price and rep models used for batch *selection* diverge from those used to emit the resulting goals |
| `lib/aug-weights.ts` | ✓ | Log-utility migration clean; sign handling correct (per-stat `direction`, not `abs`); all 31 `Multipliers` keys covered |
| `lib/formulas.ts` | ! | S5, S11. Fallback coverage is complete; the defects are contract drift from the real API |
| `lib/factions.ts` | ! | S12 — `MEGACORPORATIONS` exported and imported nowhere |
| `lib/bitnode-sequence.ts` | ✓ | |
| `lib/goal-tracker.ts` | ! | S10 |

### R2 unit 3 findings

Maintainer-verified: S1, S2.

**FIXED (S1, S2).** S2: `favorToRep(target) − favorToRep(current)`, matching `tree.ts:410`. S1 was larger than first reported — `totalPrice` was a plain sum with *no* batch-position compounding for regular augs, so a 6-aug batch was underpriced 8.4× even at `numQueued = 0`. Resolved by extracting `getPossiblePurchases`, which computes an `effectiveBasePrice` (NF `1.14` level scaling folded in) and returns a rep-ascending candidate pool; `findOptimalBatch` then selects by value, orders by prereq, and prices with `1.9 ** (numQueued + position)`. `tree.ts`'s duplicate `getPurchaseOrder` was deleted and `computeAugCost` no longer re-sorts, so selection, goal construction, and costing share one order. `1.9` and `1.14` now appear once each on the price path.

**Still open after that work:** S3 is the same divergence on the rep side — `getPossiblePurchases` scales NF rep by `1.14 ** (installedNFCount + i)` while `computeRepReq:55` starts the offset at 0. Needs the in-game check below. Also: purchase order is value-descending (inherited from the selection sort) where cost is minimized by price-descending, so the batch is priced accurately but bought sub-optimally.

**High**
- ~~**S1** `aug-select.ts:170,179` — the `1.9^numQueued` queued-aug price multiplier is applied to NeuroFlux entries but **not** to regular augs~~ **FIXED, see above.** Original text:, while `computeAugCost:68` applies it to everything. With 3 augs queued, `findOptimalBatch` prices a batch at ~$105M that the emitted `AUG_MONEY` goal prices at ~$700M. Faction ranking and the goal it produces come from two different cost models. Secondary: `1.9**(numQueued + i)` assumes NF is bought first, but `computeAugCost` sorts price-descending so NF is bought last.
- **S2** `aug-select.ts:235` — `calculateFavorToRep(favorToDonate - currentFavor)` computes `favorToRep(Δfavor)` instead of `Δ(favorToRep)`. The function is exponential (`25000·(1.02^f − 1)`) and therefore not translation-invariant. At `favorToDonate = 150`, `currentFavor = 100`: correct is ~306,400 rep, code gives ~42,290 — a 7.2× underestimate that pushes `shouldPursueFavor` toward the reset-and-donate path when direct grinding is faster. Error is exactly 0 at favor 0 and grows with favor — absent when the favor path is implausible, largest when it is seriously considered. `tree.ts:410-412` has the correct arithmetic 175 lines away.

**Medium**
- **S3** `aug-select.ts:171` vs `:55` — NF rep requirement scaled with two different exponent offsets (`1.14**(installedNFCount + i)` vs `1.14**i`) from the same stored value. Both cannot be right; `:171` appears to double-count. `bin/goals.ts:68,71,119,122` repeats it for display.
- **S4 — FIXED.** Replaced the hardcoded rule with `ns.singularity.getFactionEnemies`, captured per faction into `singularityData.factionEnemies` by `boot/data4.ts` (3GB × mult, under data4's reserved 5GB, so the `inPlace` shrink is unaffected). `getAccessibleFactions` now excludes a faction only when the player belongs to one of *its* listed enemies, guarded `?? []` to match the adjacent `factionRequirements` line. Sourcing from the game means the graph cannot drift. Tests: `makeStaticData` takes an optional enemies map; the old "Sector-12 cannot switch to Aevum" case — which encoded the bug — became a hostility test using Volhaven (hostile to all five others) plus a new alliance regression asserting a Sector-12 member *can* pursue Aevum. `factionEnemies` added to both fixture paths. Original text: ~~city-faction exclusion treats all six as mutually exclusive, but Sector-12/Aevum are allies, as are Chongqing/New Tokyo/Ishima. Joining Sector-12 permanently hides Aevum's aug pool. A hard gate of the kind the design doc rules out. `lib/test/faction-selection.ts:245` encodes the same wrong assumption, so the suite won't catch a fix.
- **S5 — MOOT, no live consumer** (verified R6). `lib/hacknet.ts` is imported only by `bin/hacknet.ts`, which is unreachable: `services.ts:31` `playerLikesHacknet = false` makes `enableHacknet` permanently false, so it is not even `isViable`. The divergence is real but nothing reads it. Re-open only if `playerLikesHacknet` is ever turned on — same gate as the other `bin/hacknet.ts` items. Original: `formulas.ts:294` — the mock's `hacknetNodes.moneyGainRate` defaults `prodMult` to the player's production multiplier; the real API defaults it to `1`. `lib/hacknet.ts:11` passes three args, so every hacknet upgrade's projected profit drops ~4× the moment the player buys Formulas.exe.
- **S6 — IMPLEMENTED (untested in-game).** Producer side in `burners.ts` (maintainer): an `actionRecorder` closure measures `max(installAverage, recentAverage)` over full mission→recover→mission cycles, weights `getActionRepGain` by the midpoint of `getActionEstimatedSuccessChance`, and publishes `playerData.bladeburnerRepRate`. Recording is bounded by actual action starts — `$startAction` now returns `boolean` and `$start` records only on `true` — so no per-tick inflation. Consumer side: `computeRepRate`'s Bladeburners branch now returns the published rate; `getBladeburnerTree`'s inline `currentRep / timeSinceReset` duplicate is deleted in favour of the same value, keeping its `waitGoal` when the rate is 0; `buildFactionGoalTree` gained an optional `bladeburnerRepRate` prop threaded into both `findOptimalBatch` and `computeRepRate`; `goals.ts` reads it from `playerData`. **One implementation, two callers, no duplicate.** `computeRepRate` also lost its `factionRep` and `lastAugReset` params — `factionRep` was used *only* by the Bladeburners branch, so it fell out naturally. Behaviour when no rate exists: `getBladeburnerTree` returns `waitGoal`; in the general faction competition `findOptimalBatch` yields utility 0 → empty batch → `buildFactionGoalTree` returns `null`, so Bladeburners is excluded rather than mispriced. Also removes a latent NaN — with `lastAugReset` unset the old code computed `0/0`, which propagated NaN through `cost` and made every comparison false. `yarn lint`, `prettier` and `knip` all clean. **Superseded design note:** Worse than first reported: `playerData.factionRep` is written **only** by `lib/sing.rip.ts:70-75` via `ns.singularity['getFactionRep']`, so without SF4 it is never populated and `computeRepRate`'s Bladeburners branch returns **0 permanently** — not merely undervalued early in a cycle. Affects exactly the BN6/BN7-without-SF4 population that C5's open half concerns.
  **Agreed approach** (maintainer): move measurement into `burners.ts` using `ns.bladeburner.getActionRepGain` (bladeburner namespace, flat 4GB, no SF4 requirement — fits `burners.ts:69`'s existing `1.60 + 5m` reservation, helper is 5.60GB, matching the bladeburner max already in the R6 audit). Publish the rate; the goal engine consumes it instead of deriving one.
  - Rate is `max(installAverage, recentAverage)`. The two estimators are degenerate in opposite conditions — `installAverage` at the start of a cycle, `recentAverage` during a recovery phase — so `max` picks whichever is live, and they converge in steady state. Mildly biased upward during transitions; acceptable against the current systematic zero.
  - `recentAverage`'s window is a full **mission → recover → mission** cycle, so it measures the sustainable rate rather than the active phase. Needs only a rep-this-cycle and a current-mode variable — no timeline (past attempts at those were too brittle). Mode is already implicit in `burners.ts:112-124`: the `mission != null` branch is rep-earning, Training/Diplomacy/Field Analysis are recovery.
  - Pre-join and pre-first-measurement use **`waitGoal`**, not a thresholded constant and not a nulled rep goal. A small constant would make a fabricated rate *selectable*; nulling the goal is structurally G4/S7 (missing cost reading as zero cost). `tree.ts:539` already does this.
  - `aug-select.ts` needs no fallback: `findOptimalBatch` initialises `let best = { utility: 0 }`, so a zero-utility faction already yields an empty batch and is excluded cleanly. Thresholding would *break* that.
  - `getActionRepGain` is success-conditional ("average reputation gain for *successfully completing*"), so multiply by `getActionEstimatedSuccessChance` — already fetched at `burners.rip.ts:38` — or let failures fall out of wall-clock elapsed time.
  - Consolidate `computeRepRate` and the inline duplicate at `tree.ts:539` as part of this; the duplication is why the zero-guard landed in one consumer and not the others.
  - **Watch:** the planner rewrites `playerData` every cycle from `lib/player-data.ts` via a spread at `planner.ts:78`. Confirm a service-published rate survives that refresh; `moneyData` is the store already designed for service-published rates.
  Original: `aug-select.ts:88-91` — Bladeburners rep rate is `cumulativeRep / timeSinceInstall`; the `: 0` fallback guarantees a division by zero, and rep is zeroed on install, so Bladeburners scores `utility = 0` for a member until something else earns it rep.

**Low** — ~~S7 `:266` hard gate excluding Netburners outside BN9 (compensating for G4)~~ **DONE** — maintainer removed the gate during the goal-engine time-semantics work; the `?? 0` that made it necessary no longer exists; S8 `:92-98` `Math.max(0, NaN)` is `NaN`, so the optional-chaining guards emit NaN rather than a safe 0; S9 `:240` prices a post-reset scenario with the pre-reset queue-inflated cost (biases opposite to S1, doesn't cancel); S10 **(over-stated as first logged)** `goal-tracker.ts` snapshot buffer on `globalThis` is not cleared on install or node reset, but it *is* age-evicted — `HISTORY_MS` is 10 min and the eviction loop drops anything past the cutoff, so the splice across an install boundary is bounded to 10 minutes and then ages out on its own. Low; arguably useful, since the reset is visible in the chart. **New (R6):** `goal-tracker.ts:12` still types `timeToComplete: number | null` and branches on `ttcValues.some((t) => !isFinite(t))` — dead since the null removal, because `UNPRICEABLE` is `Number.MAX_SAFE_INTEGER` (finite) and nothing emits `Infinity` any more. Residue of the ten deleted coercions; the surviving behaviour (charting the large number) is what the maintainer prefers; S11 `formulas.ts:187` vs `:210` `darknetCharismaBonus` inside the `sharePower` factor for field work and outside it for security — at most one matches the game; S12 dead `MEGACORPORATIONS` export.

### Log-utility migration audit — clean
One implementation (`aug-weights.ts:60`), no linear form surviving anywhere, all consumers routed through it. Sign handling is per-stat `direction`, not `abs()` — correct, and the comment at `:57` explains why `abs()` would be wrong. `mult = 1 → 0`, `mult < 1 → negative`, both tested. `mult = 0 → -Infinity` is unguarded but unreachable. `STATLESS_FRACTIONS` remain calibrated because `ln(1+x) ≈ x` over the range augs actually use.

## Unit 3 — Scoring inputs (922 lines)

| File | Status | Notes |
| --- | --- | --- |
| `lib/aug-select.ts` | — | `resetOverhead` is a known stand-in (TODO in design doc) |
| `lib/aug-weights.ts` | — | |
| `lib/bitnode-sequence.ts` | — | |
| `lib/factions.ts` | — | |
| `lib/formulas.ts` | — | |
| `lib/goal-tracker.ts` | — | |

## Unit 4 — World + UI libs (930 lines) · reviewed R3

| File | Status | Notes |
| --- | --- | --- |
| `lib/afk.ts` | ! | W11 (auto-focus evidence only). Correctly on the permitted side of the DOM rule; listener add/remove symmetric incl. capture flag |
| `lib/backdoor.rip.ts` | ! | W6. Exact behavioural match to `backdoor.ts` |
| `lib/backdoor.ts` | ! | W6. `getPathTo` BFS verified correct |
| `lib/colors.ts` | ✓ | |
| `lib/grafting.ts` | ✓ | No-SF4 case safely guarded — `getAugEvaluator` returns `null` before `augmentations` is touched |
| `lib/hacknet.ts` | ! | W5 — unreachable in every BitNode (`playerLikesHacknet` hardcoded false) |
| `lib/layout.ts` | ! | W2 (medium), W12 |
| `lib/modal.ts` | ! | W3 (medium) |
| `lib/nav.ts` | ✓ | `globalThis['document']` correctly avoids the analyzer's 25GB charge |
| `lib/nmap.rip.ts` | ✓ | |
| `lib/nmap.ts` | ✓ | Set-mutation-during-iteration is a correct BFS |
| `lib/player-data.ts` | ! | W4 |
| `lib/sing.rip.ts` | ! | W1 (high), W8, W9, W10 — highest-defect file in the unit |
| `lib/table.ts` | ! | W7 |

### R3 unit 4 findings

Maintainer-verified: W1, W2 (incl. the `08afd23` attribution).

**High**
- **W1** `lib/sing.rip.ts:112` — `ns.singularity.exportGameBonus()` / `exportGame()` use dot syntax inside a `runInPlace` callback, the only unbracketed NS calls in the file. Per the `.rip` contract this silently restores the cost being avoided: every script reaching `$backup` is statically billed 24GB with no SF4, **6GB at SF4 level 1**. Reachable from `$sing`, imported by `bin/self/love.ts` and `bin/blades/burners.ts` — the two heaviest SF4 services. Confirmed live: the generated helper in `home/tmp/bin/` contains the dotted call verbatim.

**Medium**
- **W2 — FALSE POSITIVE.** The file contained a **literal ESC byte** (0x1b), not a missing escape; `cat -A` shows `^[\[`. Verified empirically: the original and the `\x1b`-escaped form tokenize a 14-visible-character coloured row to 14 cells identically. Dashboard rendering was never affected. Two reviewers misread it because a raw control byte is invisible in rendered source — the line now uses a named `CELL` constant written with `\x1b`, and `layout.ts` contains zero literal ESC bytes. **Lesson for later units: verify byte-level claims about regexes with `cat -A`, not by reading.** Original text: ~~the ANSI tokenizer regex omits `\x1b`,~~ so the leading-prefix group can never match and each escape sequence becomes its own token. `COLOR_CODES` at `:11` *does* have it — `08afd23 "color regex fixes"` corrected line 11 and missed its twin. Widths are measured in visible characters but filled in tokens, so a real dashboard row of visible width 14 tokenizes to 18 cells, drops its last 3 characters, and shifts every box to its right. Every coloured dashboard window is affected; uncoloured ones are not, which is why the layout looks ragged rather than uniformly wrong.
- **W3** `lib/modal.ts:37` — `ns.atExit` registered without a callback id, so `bin/goals-viz.ts:284`'s own `atExit` silently replaces the tail-close handler. The tail window is never closed on kill/restart, and the orphaned titlebar keeps its `title`, so the next instance's `querySelector` can match the dead window. `lib/afk.ts:7` has the same unqualified registration; no current caller collides.

**Low** — W4 `player-data.ts:3,5` `wseAccount`/`access4SData` written every planner cycle, read nowhere (invisible to `check-data-deps` because `planner.ts:78` writes them via spread); W5 `hacknet.ts:82` new-node profit estimated from node 0's *upgraded* production, and `profitPerCost` computed then never compared — unreachable; W6 `backdoor.ts:43` `PRIORITIES` order not honoured (`find` returns first nmap-order match); W7 `table.ts:30` centre-align branch keys off the literal cell text `'empty'`, and `align: 'center'` silently right-aligns; W8 `sing.rip.ts:27` `inPlace(ns)` drops the threaded `port`; W9 `sing.rip.ts:37` `ns.gang.inGang()` disjunct disables the city-faction guard once a gang exists — feeds S4; W10 `sing.rip.ts:70` `TOR_PORT` is the only unregistered port, outside the reset range (needs one in-game check after a node reset); W11 `afk.ts:5` `keypress` misses arrows/Backspace/Escape (auto-focus evidence); W12 `layout.ts:68` sort comparator not antisymmetric for two height-1 windows.

### `.rip` audit — 7 of 9 callbacks fully clean
Both failures are bracket-rule violations; only W1 costs RAM (W9's `inGang` is 0GB). No closure violations anywhere. `backdoor.rip.ts:7` is the one callback that could have tripped the "differently-named receiver" trap — its inner helper's parameter is literally named `ns`, so the rewrite applies correctly. `ns.enums.*` correctly left dotted (data property, no RAM cost).

## Unit 5 — Boot (491 lines) · reviewed R3

| File | Status | Notes |
| --- | --- | --- |
| `boot/boot.ts` | ! | B1 |
| `boot/call-graph.ts` | ! | B7 — dead file (knip-confirmed). Ledger's earlier `ChainedService` note was wrong: `\bService\b` cannot match inside `ChainedService`. The actually-stale token is `delegate`, which never matches `delegateAny` |
| `boot/data1.ts` | ✓ | `scriptRam` / `purchasedServerCosts` key formats verified against all consumers |
| `boot/data2.ts` | ! | B8 — correct, but 0.15GB from breaking the 8GB path |
| `boot/data3.ts` | ✓ | |
| `boot/data4.ts` | ✓ | The `inPlace` RAM reservation is exactly the max helper cost, so every shrink lands positive |
| `boot/data5.ts` | ✓ | Clean in itself; unreachable at SF4 lvl 1–2 on a small home (B1) |
| `boot/data6.ts` | ! | B2 (high), B4 |
| `boot/defer.ts` | ! | B5, B6. Spawn mechanics themselves correct |
| `boot/network.ts` | ✓ | |
| `boot/reset.ts` | ! | B9 only — port range, clear/write ordering, `tmp` and log pruning all verified correct |
| `boot/ui.ts` | ✓ | |
| `boot/util.ts` | ✓ | |

### R3 closures

- **B1 — NOT A DEFECT.** Default home RAM is set to 32GB on defeating BN1.1, so SF4 (which requires beating BN4) implies ≥32GB. `data5` (27.6GB worst case) and `data6` (16.1GB) always fit; only `data4` (83.6GB at SF4.1) needs its guard. Sub-32GB homes exist only during a first playthrough, where neither stage is scheduled.
- **B2/B3 — FIXED.** `StaticData` now nests the 13 `data4` fields under `singularityData?` and the 3 `data6` fields under `graftingData?`, making conditionality visible to the type system. `boot/data6.ts` skips the violet patch when `singularityData` is absent rather than throwing on `undefined.find`. All 11 consuming files updated: bail-to-empty where a caller can degrade (`getPossiblePurchases`, `findOptimalBatch`, `buildFactionGoalTree`, `getGraftTargets`), print-and-return in SF4 services (`love.ts`, `sleeves.ts`), throw in the manually-run `bin/goals.ts`. `getAugEvaluator`'s param widened to `| undefined` to match its own runtime null check.
- **W1 — FIXED.** Bracket syntax restored on both singularity calls.
- **W10 — NOT A DEFECT.** Port data does not survive an install, and `purchaseTor` is idempotent, so the purchase cache cannot go stale.
- **W13 — FIXED.** All four sites now filter `hacknet-`.
- **S3 — RESOLVED.** `getAugmentationBasePrice` returns a base scaled only by the BitNode multiplier; `getAugmentationRepReq` returns the *current* requirement. So price takes `1.14 ** (installedNFCount + numQueued)` and rep takes `1.14 ** numQueued` alone. `possiblePurchase` now takes the two offsets separately; `computeRepReq`'s offset-0 was correct all along.

### R3 unit 5 findings

Maintainer-verified structurally: B1, B2. The exact RAM thresholds depend on SF4-level multipliers and were not verifiable offline.

**High**
- **B1** `boot/boot.ts:20,23` — only `data4` gets a RAM-fit guard. `data5` is pushed unconditionally *inside* the SF4 block and `data6` unconditionally on SF10, though both are large (agent's estimates: `data5` 27.6/9.6/5.1GB by SF4 level; `data6` 16.1GB). A player who just earned SF4.1 entering a new BitNode has an 8GB home, so `data3` spawns `data5`, `ns.spawn` kills `data3` and then fails to start `data5`, and `/bin/eight-gig.ts` is never reached — **the OS never boots**. Invisible: the spawn-failure message goes to the log of the script `ns.spawn` already killed.
- **B2** `boot/data6.ts:21-23` — reads `staticData.augmentations`, written only by `data4`. The two stages' conditions are independent (SF10 vs SF4), so entering BN10 without SF4 gives `undefined.find` and kills the stage before `planner.ts` is ever spawned. Also reachable *with* SF4 whenever home is smaller than `data4` — the normal state at the start of every BN10 install cycle. The `!` assertion masks the second failure mode. This is the only read-before-write violation in the chain.

**Medium**
- **B3** `lib/data-store.ts:76-94` — 13 `data4`-only and 3 `data6`-only fields are typed non-optional, so consumers of conditional data type-check while crashing. This is what let B2 ship, and it hides two more of the same shape, both gated on SF10 with no SF4 or RAM gate: `bin/sleeves.ts:53` (`staticData.crimeStats`) and `lib/grafting.ts:12,21` (`augmentations.filter`). **Fixing B2 without these just moves the crash downstream.**

**Low** — B4 `data6.ts:24` pushes a duplicate violet entry that `data4` already seeds via `SPECIAL_AUGS` (fallout from the "including them in data4" commit); B5 `defer.ts:7` logs `ns.args` not `args`, so `boot.ts`'s one observable print of the computed sequence is empty — the log line that would have made B1/B2 visible; B6 `defer.ts:8` unguarded destructure of an empty list; B7 dead `call-graph.ts`; B8 `data2.ts` at 7.85GB of 8; B9 `reset.ts` clears stores without stopping a running OS (manual `run start.ts` only).

### Stage/field map

| Stage | Condition | Store | Fields |
| --- | --- | --- | --- |
| `reset` | always | hostnames | whole list |
| `ui`, `network` | always | — | — |
| `data1` | always | staticData | `resetInfo`, `installedAugmentations`, `scriptRam`¹, `serverBackdoorRequirements`, `purchasedServerLimit`, `purchasedServerMaxRam`, `purchasedServerCosts`², `startingServerValue`³, `favorToDonate` |
| `data2` | always | staticData | `bitNodeMultipliers`⁴, `hacknetMultipliers` |
| `data3` | always | playerData | `player`, `homeRam`, `wseAccount`, `accessTixApi`, `access4SData`, `access4SDataApi` |
| `data4` | SF4 **and** home ≥ its script RAM (~83.6GB at SF4.1) | staticData | `factionAugmentations`, `augmentations`, `augmentationNames`, `augmentationPrices`, `augmentationRepReqs`, `augmentationPrereqs`, `augmentationStats`, `factionFavor`, `factionRequirements`, `factionWorkTypes`, `companyFavor`⁵, `companyPositions`⁵, `crimeStats` |
| `data5` | SF4 — **no RAM gate (B1)** | playerData | `homeRamUpgradeCost` |
| `data6` | SF10 — **no SF4 gate (B2), no RAM gate (B1)** | staticData | `augmentations` (appends violet — B4), `graftableAugmentations`, `augmentationGraftPrices`, `augmentationGraftTimes` |
| `planner` / `eight-gig` | `homeRam <= 8` → eight-gig | — | terminal, does not call `defer` |

¹ `ns.ls('home')` format, no leading slash. ² power-of-two keys down to 2; `1` absent. ³ non-zero only in BN9/SF9.3 on a first cycle. ⁴ always written; `null` unless BN5/SF5. ⁵ confirmed orphans, read nowhere.

Never written by boot: `staticData.materialData`/`industryData`; all optional `playerData` fields except `homeRamUpgradeCost`; all of `moneyData` (`reset` clears the port, `getMoneyData` supplies defaults).

## Unit 6 — Hacking core (940 lines) · reviewed R4

| File | Status | Notes |
| --- | --- | --- |
| `bin/thief.ts` | ! | H1, H6, H7, H8, H9, H12, H13, H14 — highest-defect file in the unit |
| `bin/pool.ts` | ! | H5, H22. H4 fixed |
| `bin/eight-gig.ts` | ! | H16. H3 withdrawn — see Rounds |
| `bin/share.ts` | ! | H20, H21, H22 |
| `bin/dispatch.ts` | ! | H15 |
| `bin/access.ts` | ! | H19 only — nuke/BFS logic and the retry loop verified correct |
| `bin/infect.ts` | ! | H18 only — full/partial split and the `boot`/`usr`/`tmp` exclusions verified correct |
| `bin/workers/hack.ts` | ✓ | 1.70GB, no imports |
| `bin/workers/grow.ts` | ✓ | 1.75GB, no imports |
| `bin/workers/weaken.ts` | ✓ | 1.75GB, no imports |
| `bin/workers/share.ts` | ✓ | 4.00GB, self-terminating 5–9 cycles as documented |
| `bin/workers/charge.ts` | ✓ | 2.00GB, argument validation complete |
| `bin/wolf.ts` | — | **Deleted.** H10, H11, H17, H23 moot |

### R4 unit 6 findings

Prefixed `H` here to avoid collision with unit 1's `F` series. H2 and H3 were withdrawn (see Rounds).

**High**
- **H1** `thief.ts:56` — `weak1Threads = getWeakThreads(0.002)` is sized for exactly one hack thread, neutralising at most 25. The frame-sizing loop at `:203` grows `hackThreads` into the hundreds on any real pool, so security walks away from minimum mid-run: the take falls below what `hackAnalyze` predicted, and at ~1.3% slowdown the GROW landing crosses ahead of the WEAK1 landing so grow runs at elevated security. `weak2Threads` on the next line scales correctly with `growThreads`, which is what makes this look unintentional. **FIXED** — `getWeakThreads(SEC_PER_HACK * hackThreads)`. Confirmed in game on a pre-SF5 save.
- ~~**H4** `pool.ts:92` — `ns.formulas.hacknetServers.hashUpgradeCost` on the unconditional path~~ **FIXED.** `services.ts:84` now gates pool on `hasFormulas` as a *condition* (re-evaluated each tick, so buying Formulas.exe mid-cycle starts it), and the inner `fileExists` branch was removed.

**Medium**
- **H5 — FIXED** (bbadb8c, untested in-game). `getTargetUpgrade` now reads `playerData.currentWork` (published by `love.ts:304-305` every 200ms) instead of calling `ns.singularity.getCurrentWork()`, removing the singularity reference from `pool.ts` entirely along with the `hasBitNode`/`getStaticData` imports. **A runtime guard would not have worked** — RAM is billed statically for any NS function appearing in the source, so an SF4 ternary still pays the full `0.5GB × 16` for a player without SF4. Reading from the store drops it to 0GB *and* gives the right fallback for free: without SF4 love does not run, the field is absent, `currentWork?.type` is `undefined`, and the default `'Sell for Money'` branch is taken. Original: `pool.ts:97` — `ns.singularity.getCurrentWork()` with no SF4 gate. `enablePool` is `hasNode(9) && currentNode !== 8`; a player with SF9 but not SF4 gets a pool that is 8GB heavier (0.5 × 16) and throws each cycle.
- **H6 — FIXED.** `getFrame` now passes `hostname`. Same class as the `ns.getServerMaxRam()` slip found later in `ram-router`: an optional parameter silently substitutes the calling host, and `tsc` cannot object. Original: `thief.ts:49` — `ns.getWeakenTime()` called without `hostname`, which is in scope and used by every other call in the function. Measures the weaken time of whatever host the planner placed thief on, so `concurrentFrames` and `peakRam` — the loop's only stopping criterion — are computed against the wrong clock. `:200` correctly passes `target`.
- **H7 — FIXED.** The WGW pass now solves for the grow/weaken ratio instead of splitting evenly: `passRam / (1.75 * (1 + WEAK_PER_GROW))`, with a one-thread margin so `weak2Threads`' rounding-up cannot overshoot and abort the pass. Verified numerically across pool sizes — grow threads rise **1.85×** and pool utilisation goes from ~54% to ~100%, with the degenerate tiny-pool case unchanged. `getSetupTime` was fixed in the same change; leaving it on the old 50/50 assumption would have overestimated setup time by the same factor and biased target scoring the other way. Original: `thief.ts:173-179` — the setup pass reserves half the pool for a weaken needing ~8% of it, leaving ~46% idle on a 10,000GB pool. `getSetupTime:44` bakes the same 50/50 split into target scoring, so the estimate is consistent with the waste rather than exposing it.
- **H8 — DEFERRED by maintainer.** The frame-sizing half was **withdrawn**: `concurrentFrames` is in the hundreds, so `peakRam` crosses 90% of the pool after a handful of iterations — the `1/hackAnalyze` bound is theoretical, not practical. The dispatch half stands but is accepted: fetching fresh RAM each pass is the more robust trade, and lag can be addressed if it ever shows up (it would appear as batches landing in clumps, not as a hang). Original: `thief.ts:203-211, 250-264` — two data-dependent loops with no yield. The frame-sizing loop is bounded only by `1/hackAnalyze(target)`; the dispatch loop stops sleeping once it falls behind its 200ms schedule and can run 15,000 iterations back-to-back. `angel.ts:406-408` has the 200ms yield pattern in the equivalent position.
- **H9 — INTENTIONAL, not a defect.** The throw is a canary: RAM is measured immediately before it is taken, and there is **no `await` between the snapshot and the execs**, so under cooperative scheduling no other script can intervene. A reviewer objection that it could fire for a missing worker script was **withdrawn** — `boot/network.ts:20-22` infects *every* hostname unconditionally (`scp` needs no root access) and the network is static, so any rooted host already has the workers; `sysadmin.ts:53` upgrades purchased servers in place rather than repurchasing, so files survive. A failed `exec` there really does mean the accounting broke. Original: `thief.ts:137` — `execWorker` throws on a failed `ns.exec` *between* runner calls, so a frame can hack without its compensating grow/weaken. `share.ts:37` and `stanek.ts:273` test `if (pid)`; angel pushes only truthy pids.

**Low** — ~~H12~~ **FIXED** — weak2 moved to `2 * SPACING` so it lands after grow rather than tied with it; the HWGW branch beside it was already correctly staggered. Was: setup grow and weaken land in the same millisecond; a mis-ordered weak2 would leave `SEC_PER_GROW × growThreads` of security on the server, re-triggering `needsSetup` and roughly doubling grooming time. ~~H13~~ **FIXED** — `maxFrames` now divides by `FRAME_SPACING`. ~~H14~~ **FIXED** — the executor's frame search was extracted as `findBestFrame` and is now called by `evaluateTarget` too, so scoring models the frame the run will actually execute (`money = maxMoney × hackPortion × hackThreads × numFrames`) and inherits the `FRAME_LIMIT` cap. Sharing the search is what stops the two models drifting apart again; cost is ~2.5× the NS calls in `getTarget`, once per batch rather than per frame. H15 `dispatch.ts:7` delegation never awaited; H16 `eight-gig.ts:5` positional `const [home, n00dles] = hostnames` assumes scan order; H18 `infect.ts:36` worker `scp` runs unconditionally, duplicating the branch above it (~70 redundant calls on the boot path); H19 `access.ts:28` progress message prints the failed-accumulator length and has a stray `}`; H20 `share.ts:14` `SHARE.includes(process.filename)` is the inverted substring test; ~~H21~~ **FIXED by the RAM-policy redesign — see the cross-cutting note above.** Was: `share.ts:33` omits `HACKER_POLICY`, so share drives home to the 4GB `DEFAULT_POLICY` floor while `angel`/`thief` demand 16GB of headroom, computing `ramAvailableTo(home) = max(0, 4 - 16) = 0` and dropping home out of the hacking pool entirely (`stanek.ts:268` same). The laxer policy won by acting first; H22 hot-path waste in `share.ts:48` and `pool.ts:157`.

### Worker RAM audit
All five workers import nothing; costs are base 1.60 plus the single NS call. The `script === HACK ? 1.7 : 1.75` literals in `thief.ts:147,257` and `angel.ts:369,377` match exactly, as does `lib/ram.ts`'s `34`/`35` integer scaling. The sizes are duplicated as literals across four files with no shared constant — adding any NS call to a worker silently invalidates all of them.

### Notes for later units
- **`angel.ts` is the clean reference for four of thief's defects.** It derives both weaken counts from `weakenEffect` (vs H1), passes `target` to every timing call (H6), pushes only truthy pids (H9), and yields every 200ms (H8). A thief fix pass can copy its shapes directly.
- `moneyData.theft` is written by both and read only at `dashboard.ts:318-327`; thief's `money` field uses a different model than angel's (H14), so the same cell means different things depending on which service is active.
- Both declare `let workerId = 0` at module scope, which resets on every service restart.

## Unit 7 — Control plane (683 lines) · reviewed R4

| File | Status | Notes |
| --- | --- | --- |
| `bin/planner.ts` | ! | C1 ruled intentional; the unbooted-store guard now returns |
| `bin/services/services.ts` | ! | C4, C5, C9, C13, C16 — highest-defect file in the unit. C2 fixed |
| `bin/sysadmin.ts` | ! | C8, C10, C11 |
| `bin/nerd.ts` | ! | C3, C12 |
| `bin/hinter.ts` | ! | C7 |
| `bin/trailblazer.ts` | ! | C6 |
| `bin/nvim.ts` | ! | C14 |
| `bin/phil.ts` | ! | C15 |

### R4 unit 7 findings

- **C1 — INTENTIONAL.** `showServices()` inside the per-service loop keeps the UI live between blocking `check()` calls. Separable and still open: `toData()` re-evaluates `condition(ns)` per render, and `services.ts:67-69`'s `preferBlade`/`useBlade`/`canWork` each run `getGoals`. Memoizing `buyingBlade` per cycle would fix that without touching the render cadence.
- **C2 — FIXED.** `hasNerd()` read live state in an `isViable`, which is evaluated once at planner start — so after nerd bought 4S access its viability stayed frozen true while `couldTrade()` flipped true, running both stock strategies on the same 33 symbols and overwriting each other's `moneyData`. `nerd.ts` now disables itself on a successful purchase.
- **C3** `nerd.ts:179` — `ns.singularity.softReset` is `5GB × 16` without SF4, and BN8 does not imply SF4. **Resolution: SF4 becomes a hard requirement for BN8** (maintainer decision) — not yet reflected in `hasNerd`.
- **C4** `services.ts:44` — `hasSingularity()` tests SF4 *ownership*, but the SF4 services need `staticData.singularityData`, which also requires `home ≥ ~84GB` at boot. **Largely resolved:** `love.ts` now drives its own recovery (upgrade home RAM → `stop.ts start.ts`), and the typical SF4.1 path places love on a 128GB cloud server. `hinter`/`trailblazer` staying hidden in that window is accepted. Residual is the BN4.1 → BN9.1 direct entry, now in `BACKLOG.md`.
- **C5 — second half FIXED** (verified R6): `hasSimulacrum()` now reads `ownedAugs`, the installed∪queued union, so burners is no longer killed in the purchased-but-not-installed window. **Still open:** `useBlade` depends on the goal engine emitting `BUY_AUG THE_BLADE`, which is impossible without SF4, so `burners.ts` never starts in BN6/7 for a player without SF4 until they own the aug by some other route.
- **C6** `trailblazer.ts:22` → `nav.ts:52,97` — `sendTerminalCommand` clicks "Do something else simultaneously" and the compensating `clickButton('Focus')` is a no-op once the UI is on the Terminal tab, so a 10Hz loop silently unfocuses the player's work. Judged a DOM-for-decisions violation rather than a sanctioned exception.
- **C7** `hinter.ts:10` — the only advice the non-SF4 advisor gives is an untracked, unthrottled toast fired once per second forever.
- **C8 — FIXED.** `getTimeToMilestone(ns) ?? HORIZON_MS / 1000` replaces the `Infinity` fallback, so the `Infinity * 0 = NaN` path is gone and "unknown time" now means the same 30m horizon the goal engine and `angel.ts:234` already use. Original text: ~~`while (profit(minRam) < 0)` is vacuously false when `profit()` is `NaN`, so the profitability gate is bypassed and a 4GB server is bought. Mirror of G2, where `timeToGoal === 0` made the same expression always negative.
- **C9 — SUBSTANTIALLY CLOSED by the RAM-policy redesign.** `takeSnapshot`'s `shouldShare` gates share's *allotment* on `currentWork.type === 'FACTION'`, so share holds zero threads when the player is not earning rep — which was the actual cost. Residual: `canShare` still starts the process on hacking level alone, so `share.ts` runs and idles. No `getGoals` call was needed after all; the signal came from `playerData.currentWork`. Original text below. ~~re-verified R6, open but BLOCKED.~~ `services.ts:73` `canShare = () => player(ns).skills.hacking > 100` — still no goal awareness, no `currentNode !== 8` guard; `share.ts` then holds 10% of all rooted RAM for rep even when the plan is money-bound. `isRepBound` is exactly the predicate wanted, but calling it from `services.ts` adds another `getGoals` per cycle — the memoization the maintainer deferred ("the game runs smoothly, and I'm afraid of regressions"). The BN8 half is moot while `[8, 1]` is commented out of `bitnode-sequence.ts`. Revisit with memoization.
- **Low** — C10 `sysadmin.ts:85` dead `totalIncome == null` guard; C11 `sysadmin.ts:114` `disableService` not awaited and re-issued ~20×/s; C12 `nerd.ts:124,138` `totalProfit` credited before the success check; ~~C13 `services.ts:22` `stockStarterCost` omits `WseAccountCost`~~ — **withdrawn in R6.** The `.d.ts` at `:1704` states explicitly that TIX API access can be bought without a WSE account, and `trader.ts` never calls `purchaseWseAccount` (its only call site is `purchase-augs.ts:129`, SF4-only). The omission is correct; C14 `nvim.ts:29` a payload without `id` permanently disables the bridge; C15 `phil.ts` is a CLI tool in `bin/` with an unguarded Formulas dependency; C16 `services.ts:101` `removeService` splices on a possibly `-1` index (verified not currently reachable).

### Contracts for later units
- **`isViable()` is a one-shot snapshot**, evaluated once at `planner.ts:19`. Any predicate reading live state produces a service stuck on or stuck off until the next install. `hasNerd` was the only violation.
- **`condition()` runs ~2n times per planner cycle**, from the planner process — so its cost is billed to the OS clock and paid for statically in `planner.ts`'s RAM. `getGoals`, `ns.getPlayer`, `ns.corporation.canCreateCorporation`, `ns.heart.break`, `ns.fileExists`, two `ns.stock` calls and a `document.querySelector` are all currently on that path.
- **Service array order is start priority under RAM pressure.** Both reshuffles (BN3 corp promotion, large-home angel/thief demotion) verified correct — neither can duplicate or drop an entry.
- `dashboard.ts:244`'s `lastRuns[script] < cancelTime` filter drops never-run scripts (`undefined < n` is false), so the DELAYS panel hides its most important case. Unit 8.

### Predicate / goal-engine mismatches
Distilled from the full 24-service table. Every predicate except `hasNerd` derives from boot
constants; these are the cases where a service's gating disagrees with what the OS is pursuing.

| Service | Mismatch |
| --- | --- |
| `self/love.ts` | `preferBlade` makes `canWork` false, stopping the only `purchase-augs.ts` path, while the goal engine may still emit an install goal (C4/C5) |
| `blades/burners.ts` | `useBlade` needs a `BUY_AUG` the engine cannot emit without SF4; also killed in the queued-but-not-installed window (C5) |
| `gang/don.ts` | `gangsAllowed` admits any SF2 node, but `goals.ts:140` emits a karma goal only for BN3/BN7 at `sfLevel >= 1`. In BN1.2 with SF2, `don` is viable and visible but nothing drives karma to −54000, so it never starts |
| `share.ts` | `canShare` is hacking-level only — no `isRepBound` awareness, no BN8 guard (C9) |
| `stanek.ts` | Does not check `playerData.hasGift`; SF13 owned but gift not accepted still starts it |
| `grafting.ts` | Does not check `hasGraftingData(staticData)`, the predicate for the `data6` group |
| `sleeves.ts` | `hasSleeves = hasNode(10)` omits SF4, but `sleeves.ts:53` reads `crimeStats`, which is `data4`-only. Guarded at `:224`; `love.ts` shows the alternative |
| `thief.ts` | `hasThief = !hasNode(5)` retires thief in *every* node once SF5 is owned, forcing angel onto mocked formulas wherever Formulas.exe is unaffordable |

## Unit 8 — Goal consumers + viz (1449 lines) · reviewed R5

| File | Status | Notes |
| --- | --- | --- |
| `bin/angel.ts` | ! | A1, A2, A3, A4, A6, A10, A13 — three highs, all on the money path |
| `bin/dashboard.ts` | ! | A5, A8, A9, A12. DOM use sanctioned throughout; registers no `atExit`, so `modal.ts:37`'s handler survives |
| `bin/goals.ts` | ! | A7 only. `getSF4StaticData` narrows correctly; both display loops sleep 2000ms |
| `bin/goals-viz.ts` | ! | A11 only. DOM use sanctioned; `rafId` lifecycle correct in itself (the window leak is W3) |

### R5 unit 8 findings

Maintainer-verified: A1, A2, A3.

**High**
- **A1 — FIXED** (earlier session; verified R6). `services.ts:42` is now `hasThief = () => !hasPermanentFormulas`, so `useAngel = preferAngel() || !hasThief()` collapses to "has Formulas.exe". The eight direct call sites are unchanged but unreachable without it — fixed at the predicate rather than by routing through `lib/formulas.ts`, which is the right call given the mock implements only `hackExp`/`hackTime`. Original: `angel.ts:55,70,104,149,180,182,249,250` — angel calls `ns.formulas.hacking.*` directly at eight sites, never through `lib/formulas.ts`, but `services.ts:56`'s `useAngel = preferAngel() || !hasThief()` with `hasThief = !hasNode(5)` makes its condition **unconditionally true once SF5 is owned**, Formulas.exe or not. There is no fallback to degrade to: the mock's `hacking` namespace implements only `hackExp` and `hackTime`, not `weakenEffect`/`growThreads`/`hackPercent`/`weakenTime`. Enter BN6.1 with SF1+SF5 before affording Formulas.exe ($5B): `thief` is filtered out by `isViable`, `angel` starts and throws, the planner restarts it, it throws again — **no hacking income for the whole cycle**, symptom limited to an exception in a killed script's log. *This corrects the unit-7 predicate table, which recorded this row as "forcing angel onto mocked formulas"; it is a hard throw.*
- **A2 — FIXED.** `Math.max(0, horizon - setupTime)`. Original: ~~`earningTime = horizon - setupTime` is unclamped, so when setup exceeds the horizon `timeframeIncome` is negative *and proportional to `money`*. `:274`'s filter and `:276`'s max-reduce then select the **least negative**, i.e. the lowest-yield target. Triggered by any goal root reporting `timeToComplete() === 0` — the early-install plan (`tree.ts:447` → `installGoal([], actions)`, no deps) and the XP gate both qualify. `Math.max(0, horizon - setupTime)` fixes it.
- **A3** `angel.ts:181` — `money = moneyMax * hackPercent * hackThreads * numFrames` is uncapped and linear in `numFrames`, where the true figure is `moneyMax * (1 - (1-p)^numFrames)`. All frames land at the same instant (`:396-398`), so one wave cannot exceed `moneyMax`. The overstatement scales with `1/frameRam`, systematically favouring small cheap servers — the classic n00dles trap, reintroduced by an uncapped formula. Feeds `timeframeIncome`, `timeToTarget`, and `moneyData.theft.money`.

**Medium** — A4 `:182` cycle time measured at *live* security while `hackPercent` and the frame come from `whenReady` (min security), double-penalising un-prepped servers and disagreeing with `getQuickScore:250`; A5 **FIXED** (`(lastRuns[script] ?? 0) < cancelTime`, and never-run scripts now report time since cancellation rather than `?? Infinity`, which `:248`'s `>= 10` filter discarded) — was: DELAYS filter drops never-run scripts (`undefined < n` is false) — the starved-script case it exists to show, and why `:245`'s `?? Infinity` is unreachable; ~~A6~~ **INTENTIONAL** — the batch-abort deliberately leaves `moneyData.theftIncome` at its previous value. Maintainer: average theft income is monotonically increasing in most cases (right before an install is the only exception), so retaining the old value prevents fishtailing in the goal engine and its other consumers. Republishing a partial/aborted batch's income would be noisier, not fresher. Do not re-report; A7 `goals.ts:211` `faction-live` ranks only *joined* factions, so it cannot show the faction the OS selected, and re-derives its inputs differently from `goals.ts:95-113`.

**Low** — A8 dead `theft == null` / `moneyData == null` guards (both unreachable via `DEFAULT_MONEY_DATA`), HACKING panel renders a blank zero row instead of "loading"; A9 WORK line goes stale silently and reports "(idle)" when `love` never ran; A10 `angel.ts:332` failed `ns.exec` dropped with no signal after its RAM is booked; A11 `goals-viz.ts:227-251` ~90k array scans per animation frame for data that changes once a second; A12 `dashboard.ts:442` re-runs the whole goal engine at ~10Hz; A13 `angel.ts:372` dead negative-`additionalMsec` guard.

### angel-as-reference verification
All four properties hold, so the planned thief fix pass can copy them — with three caveats:
- `getWeakThreads:53-57` is an uncapped unit-step scan terminated by data, making `getHgwFrame`'s search quadratic. **Add an iteration cap before replicating into thief.**
- `:332`'s `if (pid)` is safer than thief's throw but loses the error entirely (A10). Copy it *with* a warning, or thief trades a loud bug for a quiet one.
- Do **not** copy `evaluateTarget` — it carries A2, A3 and A4. Copy the host-passing, not the state handling.

## Unit 9 — Self / singularity (1341 lines) · reviewed R5

| File | Status | Notes |
| --- | --- | --- |
| `bin/sleeves.ts` | ! | P1, P2, P4, P7 — highest-defect file in the unit. `murderSolver` math verified sound |
| `bin/self/love.ts` | ! | P3, P5, P6, P14. **Recovery loop verified correct**: terminates, yields, targets `home` from a remote host, matches `planner.ts:17`'s convention |
| `bin/self/aug/purchase-augs.ts` | ! | P9, P10, P13, P15. Purchase *ordering* verified correct; `softReset('start.ts')` correct |
| `bin/grafting.ts` | ! | P8, P11 |
| `bin/stanek.ts` | ! | P8 (pattern), P15, P16 |
| `bin/self/control.ts` | ! | P12 |
| `bin/self/backdoor.ts` | ! | P17 |
| `bin/self/hack.ts` | ! | P17 |
| `bin/self/actualize.ts` | ✓ | Clean in itself; its 32GB × mult cost is the mechanism behind P3 |

### R5 unit 9 findings

Maintainer-verified: P2, P3, P9, and the structural half of P1.

**High**
- **P1 — FIXED.** Reservation changed from `ns.sleeve.getTask` to `ns.singularity.getCrimeChance`, so it now names the largest helper — the same shape as `love.ts:37`'s `commitCrime` reservation. `getSleeve` (4GB) stays and still clears the 1.60GB helper base. In the same change `getCurrentWork` moved into a `$rip` block (`$currentWork`), stripping `nextCompletion` — a `Promise<void>` per `.d.ts:1763` — because ports **clone with `structuredClone()`**, which **throws `DataCloneError` on a Promise** — the write would have failed, been caught by the generated helper's inner catch, returned as an `Error`, and rethrown by `runScript`. The strip prevents a crash, not a leak. (Corrected R6; originally logged as by-reference passing.) Net static change `-4 + 4.5m`: ~+0.5GB at SF4.3, +68GB at SF4.1, nearly all of it the unavoidable `getCrimeChance` reservation. Verified: `.rip` rules all satisfied, lint clean, only two direct `ns.*` references left in the file (both in the reservation block). **Accepted cost:** `$currentWork` is fetched up to twice per 50ms tick (`:375` eagerly, `:329` via `$grindKarma`). Maintainer: "sleeves.ts doesn't need to be performant, and the RAM could matter to someone." The saving is 0.5GB × mult — 8GB at SF4.1, where home is smallest. **Do not report the helper churn in this file.** Original: `sleeves.ts:322` — `$.singularity['getCrimeChance']` is a `5GB × mult` helper, but the reservation block at `:237-239` names only `ns.sleeve.getSleeve`/`getTask` (4GB each). `inPlace` shrinks the caller by the *helper's* cost and throws `Failed to shrink…` if the caller's own reservation is smaller. **Structural mismatch confirmed — the reservation and the largest helper come from different namespaces.** Whether it currently throws depends on `sleeves.ts`'s *total* static RAM, which needs `/usr/suite.ts`; the agent compared against the largest single call rather than the sum, so treat the failure claim as unconfirmed. `love.ts:37` is the reference: it reserves `ns.singularity.commitCrime` (also 5GB × mult) precisely so its helpers fit.
- **P2 — FIXED** (earlier session; verified R6). `services.ts:97` now gates sleeves on `hasFormulas` as its *condition* rather than `hasSleeves = hasNode(10)` alone, so the five call sites are unreachable without Formulas.exe. Same predicate-level shape as the A1 fix. Original: `sleeves.ts:76-78,154,158` — five `ns.formulas.*` calls with no Formulas.exe guard; `services.ts:98` gates sleeves on `hasSleeves = hasNode(10)` alone. Fresh BN10 entry before affording Formulas.exe: `isGrindingKarma` is true by default, `murderSolver` reaches `fractionalLevel` on the first tick, throws, and restart-loops. `lib/formulas.ts` already mocks all three functions; `love.ts:185`'s `hasFormulas(ns) ? ns.formulas : formulas(ns)` is the intended pattern. Same class as unit 8's A1.
- **P3 — FIXED** (earlier session; verified R6). `lib/sing.rip.ts`'s `$win` now computes `actualizeRam`, filters hostnames to those where the script exists *and* `ram >= actualizeRam`, prints a critical error and returns if none qualify, picks the largest survivor, and `killall`s only that host — `spawn` if it is the current host, `exec` otherwise, each with its own failure print. The kill-home-then-fail-to-exec loop is gone, and the silent-failure half is gone with it. Original: `love.ts:286-289` — `$win` runs `killall('home', true)` then execs `bin/self/actualize.ts`, whose `destroyW0r1dD43m0n` is `32GB × 16` = **~514GB at SF4.1** (citable from the `.d.ts`), and discards the pid at both `sing.rip.ts:12` and the call site. Since `love` is an `AnyHostService` it normally runs *off* home, so the `killall` kills the planner and dashboard without protecting itself. At SF4.1 with home at 128GB — the ceiling `love.ts:295` drives it to — the exec fails, nothing starts, and love loops and re-kills home every ~1s forever. `control.ts:9` deliberately never backdoors w0r1d_d43m0n, so nothing breaks the state either.

**Medium** — P4 **FIXED** (`$grindKarma` returns early on an empty list) — was: `sleeves[0].sleeve` on a possibly-empty `readySleeves` (crash-loops for the whole sync period after any node reset); ~~P5~~ **FIXED** (4a30bef). Root cause was a stale `const { city } = ns.getPlayer()` captured before the travel; fixed at the source by defaulting `getSchool`/`getGym`'s `city` param to `ns.getPlayer().city`, so every call re-reads. Both school branches consolidated into one `$goToSchool` helper, which now (a) guards on `canGoToSchool` in both branches, (b) returns early when `school == null` instead of asserting `!`, and (c) skips re-issuing `universityCourse` when already taking that class — mirroring `goToGym`'s `alreadyTrainingStat`, which matters because General-Design calls out focus flickering. Travelling to Sector-12 rather than studying at a local Aevum/Volhaven university is **intentional** (maintainer: "it's almost always the correct choice") — do not report. Two intermediate revisions were caught in review: nesting `universityCourse` inside the travel block (a player already in Sector-12 — the starting city — would never study), and a surviving `getSchool(ns)!`; P6 **FIXED** (both operands now read `contender`) — was: `getWorkFaction` measures the incumbent twice, so it always returns the first goal in tree-walk order; ~~P7~~ **FALSE POSITIVE** (R6) — parameter shadowing. `$assignSleeves(sleeves: SleeveInfo[])` is called as `$assignSleeves(readySleeves)`, so the `sleeves` those branches iterate *is* the synced set; the outer binding of the same name is never reachable inside the function. Do not re-report; ~~P8~~ **FIXED** (4889f95) — the `singularityData` guard now precedes `disableLog`/`openTail`/`resizeTail`/`moveTail`, so a failed start no longer leaks a tail window per 5s restart; P9 **FIXED** (requires an `INSTALL` root; the money check applies only when an `AUG_MONEY` requirement exists, so the early-install plan — already paid for — still passes) — was: the premature-call guard is a no-op — `money < undefined` is `false` — for any root without an `AUG_MONEY` prereq, which unit 8 independently found is **7 of 10 reachable roots**; ~~P10~~ **FIXED** (verified R6) — `bin/self/aug/purchase-augs.ts` now orders bounded NeuroFlux donations (`:148-159`) → free augs → gang equipment (`:181-187`) → dump remaining balance (`:190-195`), so the whole-balance donation runs last; ~~P11~~ **FIXED** (4889f95) — `:78` is now `install != null && install.utility < utility`, matching the decision at `:62`, so the table no longer marks every row efficient when `getInstallUtility()` returns null. **Null-removal residue also cleared** in the same pass: the dead `ttc == null` branches at `grafting.ts:55,77` and the `number | null` / `isFinite` handling in `goal-tracker.ts` are both gone. No known residue remains.

**Low** — P12 `control.ts:9` becomes a 10Hz no-op once w0r1d_d43m0n is the selected target, and no other server is backdoored from then on; P13 `purchase-augs.ts:147,152` NeuroFlux rep scaled twice (the S3 resolution applies — `getAugmentationRepReq` already includes the queued count); P14 `love.ts:75-78` re-queries `crimeStats` though `singularityData` holds it — 12 helper runs per start, plus one `getCrimeChance` helper per crime per 200ms tick; P15 **`purchase-augs.ts:36` FIXED** — the dodge was unintentional and 0.5GB will never block an install, so it now pays the honest cost. `stanek.ts:218` is deliberate and commented; `dnet/mole.ts:875` is part of a manual `ramOverride` dance (unit 13). Was: bracket syntax in ordinary module code — invisible to lint and `/usr/suite.ts`, and `purchase-augs.ts:36` runs *after* `$install` has killed every service; ~~P16~~ **FIXED by the RAM-policy redesign** — `chargeThreads` is deleted; thread counts now come from `ns.ps` via `getWorkerRamState`. (Correction to the original entry: the Map was a memory leak, not a counting bug — `:233` filtered on `ns.isRunning(pid)`, so dead pids never inflated the total.); P17 `hack.ts:3` leaves the player connected to `n00dles`, and `backdoor.ts:6` ignores every `connect` return.

### .rip audit — both callbacks clean
`love.ts:51-54` (recovery reboot, 3.4GB) and `sleeves.ts:242-252` (`$getSleeves`, 9.6GB — exactly its reservation plus base) pass all three rules. The `inPlace` reservation table found one mismatch: **sleeves** (P1). `love.ts` and `purchase-augs.ts` both reserve a same-class 5GB × mult call and are fine.

## Unit 10 — Corp (1244 lines) · reviewed R6

| File | Status | Notes |
| --- | --- | --- |
| `bin/corp/plan.rip.ts` | ! | K3, K6, K7, K9, K11, K12, K14 — highest-defect file. `advance()` is bounded by `steps.length`; the `done` latch is sound |
| `bin/corp/corp.ts` | ! | K2, K5, K7, K15, K16. `inPlace` reservation verified adequate; the `STATES.at()` modular arithmetic is correct |
| `bin/corp/corp.rip.ts` | ! | K1, K8, K10, K13. `$manageProducts` funds-check ordering verified correct |
| `bin/corp/manage/tobacco.ts` | ! | K5 only (K4 withdrawn). Market-TA research gating verified correct |
| `bin/corp/plans/tobacco-plan.ts` | ✓ | K4 withdrawn; step ordering coherent |
| `bin/corp/boost-solver.ts` | ! | K17 only — the recursion and `splice` re-insertion are correct at every depth |
| `bin/corp/constants.ts` | ✓ | All 14 `CorpIndustryName` keys present |
| `bin/corp/manage/agriculture.ts` | ✓ | |
| `bin/corp/manage/chemicals.ts` | ✓ | The only manager that buys its own inputs — which is what makes K4 visible |

### R6 unit 10 findings
Maintainer-verified: K1, K2, K3.

**High**
- **K1 — FIXED.** Now `=== 'Success'`, matching `services.ts:64`; the non-`'Success'` results throw (see K2). Original: ~~`canCreateCorporation` returns `CreatingCorporationCheckResult`, a **string union** (`.d.ts:10174`), so `canCreateCorporation(selfFund) && createCorporation(...)` is always truthy and the guard is dead. The guard exists to prevent a throw the API documents for seed-money-outside-BN3 and low-softcap nodes. `in-place.ts:111` rethrows into `corp.ts:27`, which has no try/catch, so corp.ts dies and the planner restart-loops it. **`services.ts:64` does this correctly with `=== 'Success'`** — see the new charter rule on `*CheckResult` returns.
- **K2 — RESOLVED, working as intended.** Two parts. (1) Maintainer made `$createCorporation` **throw** on any non-`'Success'` result, so `corp.ts` aborts on the structural failures rather than spinning: "The tail window should not open before the corp gets started. In practice this should never happen, but it's a good safeguard against regressions." (2) The remaining `false` path — insufficient funds, since `canCreateCorporation` has no such member and `createCorporation` is documented `@returns true if created and false if not` (`.d.ts:10215`) — **retries by design.** Maintainer: "corp.ts should only run if the player has enough money to start a corp. The loop is to safeguard against money being spent while corp.ts is starting. In this case, corp.ts holds on to the RAM and keeps trying. The player doesn't want to see an empty window during this time." So the retry is the recovery mechanism for a transient balance dip, and **holding the RAM is the point** — exiting would surrender the reservation and race for it again. `ns.ui.openTail()` sitting after the loop is likewise deliberate. **Do not report the unbounded loop or the tail placement in `corp.ts:24-33` again.**
- **K3 — FIXED (untested in-game).** `expandOffices.complete` now computes `upgradeCount` and guards `> 0`, matching `expandWarehouses.complete:344-357` 45 lines below. Also avoids a 20GB helper launch per already-sized city. Lint clean. Original: `plan.rip.ts:294-303` — `expandOffices.complete` calls `upgradeOfficeSize(div, city, targetSize - office.size)` with no positivity guard, while its sibling `expandWarehouses.complete:344-357` wraps the identical delta in `if (upgradeCount > 0)`. After a partial failure mid-loop, the re-run passes `0` for already-sized cities.
- ~~**K4** `tobacco.ts` + `tobacco-plan.ts:19` — Tobacco gets neither `enableSmartSupply` (Agriculture-only) nor `$buyProductionMaterials`~~ — **WITHDRAWN, not a defect.** Maintainer confirmed in-game that Tobacco's only required material is Plants, which arrives via the Agriculture export. With no purchased inputs there is nothing for Smart Supply or `$buyProductionMaterials` to do, so both omissions are correct. The finding was conditional on `industryData['Tobacco'].requiredMaterials` containing something beyond Plants; it does not.

**FIXED in 3bfde21 — K5, K6, K11, K12, K13.** K5: `corp.ts` now emits `'-'` for cities absent from the report, with one `cities` list driving both header and rows so they cannot desync (an intermediate revision filtered only the rows, which left `table`'s positional cell mapping shifting values under the wrong city headings). **Severity correction:** K5 was logged as crashing every cycle before expansion completes — wrong. `plan.rip.ts:119-126` expands all six cities and buys all six warehouses in a single `complete()`, gated by `canStart` on `corp.funds >= totalCost` which already covers `6 × (officeInitialCost + warehouseInitialCost)`. The gap only opens on a partial warehouse purchase. K6: `numNeeded--` added, so the hire loop stops at `jobsToAssign` instead of filling the office and aborting the step. K13: single-argument `Math.max` dropped. K12: `Advertise ${divisionName}`. K11: replaced the never-matching `/{}"/g` regex with an `Object.entries` join. **Maintainer also found an unrelated display bug:** `ns.print(table(...))` ran before `ns.clearLog()`, so the boost-material table was never visible; it now prints after the clear.

**Medium** — ~~K5~~ fixed above; ~~K6~~ fixed above; K7 **(over-stated as logged — needs a per-body recheck)** unguarded spends in the `complete()` bodies; `openDivision` *does* have a try/catch at `plan.rip.ts:113-127`, so "none of which any layer above catches" is wrong. Re-verify which bodies actually lack handling before acting; K8 `corp.rip.ts:225,254` issue two redundant 20GB helper launches per material per city on the steady-state branch (~576 no-op launches per corp cycle).

**Low** — K9 `advertise.complete` loops on AdVert count while `canStart` priced one (masked: every call site uses `targetLevel = 1`); K10 three unused exports; K11 `replaceAll(/{}"/g, '')` matches the literal 3-char sequence, verified with `cat -A`; K12 `step('Advertise', …)` ignores its parameters so both advertise steps render identically; K13 `Math.max(warehouseSize / 100)` is single-argument; K14 routine `console.log` on the hot path; K15 two `getCorporation` launches per pass; K16 `corp.ts:35` duplicates the plan's first step and inflates its funds gate by ~$40b; K17 a zero industry factor yields `NaN` targets (latent — no current division has one).

### .rip and inPlace audit — clean
**13 callbacks, no closure violations and no receiver-name violations.** Three bracket-rule misses (`hasCorporation`, `canCreateCorporation`, `getConstants`) are all 0GB calls, so unlike W1 they restore no hidden cost.

**`corp.ts`'s reservation is adequate — P1's mismatch does not recur.** All 36 `$.<ns>[…]` sites are `$.corporation.*`, a single namespace, and no call exceeds the reserved 20GB `createCorporation`. The binding constraint is instead the *sum* within a callback: three reach 21.6GB (`corp.rip.ts:9`, `plan.rip.ts:275`, `:327`), against a caller with roughly 1.1GB of headroom and a zero home reserve. **Constraint to record: adding a second 20GB call to any of those three callbacks makes the shrink at `in-place.ts:86` fail outright.**

## Unit 11 — Combat (655 lines) · reviewed R6

| File | Status | Notes |
| --- | --- | --- |
| `bin/blades/burners.rip.ts` | ! | M1 |
| `bin/blades/burners.ts` | ✓ | Reservation (`:69`, 5GB×mult singularity) exactly matches its largest helper across four namespaces — see audit below |
| `bin/blades/is-ready.ts` | ✓ | Imported by `lib/goals/goals.ts` — see unit 2 |
| `bin/blades/report.ts` | ✓ | Dead truthiness guards `:64`, `:82` on non-optional params; `contentWidth(ns)` recomputed per row `:36`. Cosmetic |
| `bin/gang/don.ts` | ! | M2, M3 |
| `bin/gang/task-table.ts` | ! | M4 |
| `bin/gang/util.ts` | ✓ | `getFightWinRates`/`needsPower` correct; redundant `as string`; the two duplicate each other's body |

### R6 unit 11 findings

| # | Sev | File | Finding |
| --- | --- | --- | --- |
| M2 | Med | `gang/don.ts:87,95` | **FIXED** (3c812d2) — `async` dropped from `respect`, which was gratuitous; `by()`'s interface deliberately left unchanged. Original: the ready-member sort is a silent no-op. `respect` (`:87`) is `async`, so `-respect(name)` is `-Promise` → `NaN`; `by()` (`lib/util.ts:23-31`) compares with `<`/`>`, both false for `NaN`, so the comparator returns `0` for every pair and `sort` leaves the array untouched. `:96`'s `assignNext(readyMembers, 'Territory Warfare')` is meant to send the highest-respect member; it sends whichever `getMemberNames()` returned first. **Verified by execution:** with `{a:10,b:50,c:30}`, `['c','a','b'].sort(by(n => -asyncRespect(n)))` → `['c','a','b']` (unchanged) vs `['b','c','a']` with the sync key. The `async` is gratuitous — `memberInfo[name].earnedRespect` is local sync data. **Why `yarn lint` is clean: the unary minus.** See below |

#### Why the type system misses M2

Not an evolving `any[]` — `Asyncify<NS>` preserves return types, so `getMemberNames()` is `Promise<string[]>`, `name` is `string`, and `readyMembers` is `string[]`. Confirmed by assigning it to a `string[]`.

The hole is that **TypeScript does not constrain the operand of unary `-`**. It accepts any operand and always types the result `number`:

```ts
declare const p: Promise<number>;
const a = -p;     // no error, typed number
const b = p * -1; // TS2362: left-hand side of an arithmetic operation must be
                  //         of type 'any', 'number', 'bigint' or an enum type
const c = 0 - p;  // TS2363: same, right-hand side
```

Binary arithmetic enforces the constraint; unary minus does not. So `by((name) => -respect(name))` returns `number` and satisfies `(elem: T) => string | number`. Drop the minus and the error appears immediately:

```
Type '(name: string) => Promise<number>' is not assignable to type '(elem: string) => string | number'.
  Type 'Promise<number>' is not assignable to type 'string | number'.
```

**The descending-sort idiom is what disables the check.** `by(key)` is type-safe; `by(x => -key(x))` is not, for any `key` returning a non-number. Verified with `tsc --strict`; the project is already `"strict": true`, so no compiler setting closes this.
| M3 | Low | `gang/don.ts:59-63` | `needsTraining` tests pre-ascension stats. `memberInfo[name]` is fetched `:59`, `ascendMember` runs `:61`, `:63` reads the stale record. A member ascending from ~5000 combat stats resets to ~1 but is pushed to `readyMembers` and assigned `Human Trafficking`/`Terrorism` with 1 in every stat — near-certain failure plus wanted-level gain, until the next `nextUpdate` re-reads |
| M1 | Low | `blades/burners.rip.ts:14-15` | `$train` discards both return values; `travelToCity` and `gymWorkout` each return `boolean`. Fresh BN6/BN7 reset, player in Volhaven with < $200k: travel fails, `gymWorkout` then fails because the player isn't in Sector-12 (returns `false`, no throw), and `burners.ts:77-80`'s join loop spins at 1 Hz training nothing, with no printed signal |
| M4 | Low | `gang/task-table.ts` | Dead file (knip-confirmed); nothing imports `printTaskTable` and no service or rmi target references it. Its `main` is an `ns.tprint` table — a human-facing tool that belongs in `usr/`. Same class as C15 (`bin/phil.ts`) |

### `inPlace` reservation audit — both exact

- `burners.ts:69` reserves `typeof ns.singularity.getOwnedAugmentations` = 5GB × mult. Enumerated across four namespaces: `bladeburner` (flat) max 4GB → helper 5.60; `singularity` max `getOwnedAugmentations` 5 (via `sing.rip.ts:78`) → helper `1.60 + 5m`; `$train` (travelToCity + gymWorkout in one body) → `2.10 + 4m`; plain NS `$win` → 5.60; `gang.inGang` 0GB. Largest is `1.60 + 5m` — exactly reservation + base, which is why `:69` names that call and not a `bladeburner` one. Tightest of the four audited reservations
- `don.ts:12` reserves `ns.gang.ascendMember` = 4GB, the max of the ten `gang` calls used. Exact. `don.ts` is also the only file in units 11/12 that follows the substrate contract on ports — `inPlace(ns, randPort())` at `:18` rather than `ns.pid`

## Unit 12 — Contracts + economy (776 lines) · reviewed R6

Two unrelated domains. Reviewed as separate passes.

| File | Status | Notes |
| --- | --- | --- |
| `bin/broker/trader.ts` | ! | N7, N8, N9. `ns.stock[...]` at `:30,42,52,67,100,162` are all inside `runInPlace` bodies — correct, not RAM dodges. Confirmed by maintainer. Binary search `:25-33` correct (`-1` degenerate unreachable, `MIN_ORDER` $10M > one commission); `dumpMode` hysteresis `:113-114` correct |
| `bin/contracts/algorithms.ts` | ! | N1, N2, N5, N10. **17 of 21 solvers verified correct by fuzzing** |
| `bin/contracts/freelancer.ts` | ! | N6, N12. Reservation `:53` (`codingcontract.attempt` 10GB) exact; unknown types blacklisted without consuming a try |
| `bin/contracts/mapper.ts` | ! | N4 |
| `bin/contracts/tests.ts` | ! | N3 |
| `bin/broker/dump.ts` | ! | N11 |
| `bin/hacknet.ts` | ! | Unreachable (`services.ts:31` `playerLikesHacknet = false` → not even `isViable`). R1 items stand; see consequence note below |
| `bin/nerd.ts` | ! | Not in this unit (reviewed R4/unit 7), but shares N9's defect at `:175-179` — record against whichever pass fixes it |

### R6 unit 12 findings

| # | Sev | File | Finding |
| --- | --- | --- | --- |
| N1 | High | `contracts/algorithms.ts:305-329` | **FIXED — awaiting in-game confirmation.** Replaced the edge-list-with-deferral scheme with a per-component graph traversal: build an adjacency list, then seed every still-uncolored vertex in turn and propagate `1 - color`, returning `[]` on a same-color neighbor. Removes both causes at once, since every vertex is now reached and there is no deferral counter to exhaust. Also no longer mutates `edges` (the old `sort`/`push`), so this solver is out of N6's scope. Verified: all three previously-failing cases now valid; 40,000 fuzz cases with 0 failures, of which 8,100 were genuinely non-2-colorable (correctly `[]`) and 16,454 disconnected; triangle / 5-cycle / self-loop / odd-cycle-in-second-component all `[]`; `n=0,1,5`-with-no-edges sane; 400 vertices and 40,000 edges in 2ms. Original: `twoColor` returned "impossible" for 2-colorable graphs. Two independent causes: (a) `arr[0] = true` is the only seed, so **only the component containing vertex 0** is colored — any disconnected graph or isolated vertex ends with `undefined` entries; (b) `looper > numVertices` (`:314`) counts *consecutive* deferrals, not a full no-progress pass over the deferred queue, so a connected graph whose edge list (sorted by `a[0]` at `:308`) front-loads more than `numVertices` currently-uncolorable edges also bails. **Verified by execution:** `twoColor([4,[[0,1],[2,3]]])` → `[]` (want `[0,1,0,1]`); `twoColor([3,[[0,1]]])` → `[]` (want `[0,1,0]`); and the **connected** 11-vertex case `[[5,7],[5,10],[7,9],[5,6],[3,7],[1,10],[4,6],[3,10],[8,10],[2,5],[0,8],[3,6],[6,9],[2,9],[1,7],[9,10],[1,2],[2,4],[7,8]]` → `[]` though a proper coloring exists (confirmed connected, 11/11 reachable; bails at `looper = 12` before reaching `[7,8]`, the edge that would extend the frontier from vertex 8). `:309` already carries `// TODO: Fix this` |
| N2 | Low (latent) | `contracts/algorithms.ts:38` | **Downgraded from High — not reachable in game.** 100 in-game contracts passed. Conditional on a blocked destination only 29% of grids yield a wrong answer (the rest have every path blocked anyway, so both return 0), so a 40% destination-obstacle rate implies P(100 clean) = 4.5×10⁻⁶. The run bounds the generator's destination-obstacle rate at ≤10% (95%, rule of three), most likely 0 — the game evidently guarantees the destination clear as it does the origin. The agent's "7.6% of contracts get a wrong answer" is refuted. Defect is real for a general-purpose function and worth a one-line guard as insurance against a generator change, but nothing is currently mis-solved. Original: `countPaths` overwrites a destination obstacle. `grid[h-1][w-1] = 1` is unconditional, so a "Unique Paths in a Grid II" grid whose bottom-right cell is blocked is solved as if it were passable. Every other obstacle is handled correctly (`:40,:44,:50`), including one at the origin. **Verified by execution:** `countPaths([[0,0],[0,1]])` → `2`, correct answer `0`; `countPaths([[0,0,0],[0,0,0],[0,0,1]])` → `6`, correct `0`. Fuzzed against a reference DP, 5000 grids at 30% obstacle density: 638 wrong (12.8%), **all** destination-obstacle cases |
| N3 | Med | `contracts/tests.ts` | **DEFERRED by maintainer — sequenced after the thief changes**, so 21 solvers' worth of cases don't swamp the suite output while the goal-engine and thief tests are the ones being read. In BACKLOG. The only solver "test" is dead and covers 1 of 21 solvers. knip lists it under unused files; not a `lib/test/run-all.ts` entry and nothing imports it. It imports only `twoColor`, hardcodes one graph, and `ns.tprint`s the result with **no assertion**. So none of the 21 solvers — including the two broken above — has any coverage, and the fixed instance it contains is one `twoColor` happens to solve correctly |
| N4 | **Closed (deferred)** | `contracts/mapper.ts:29-59` | **Made visible rather than filled, and deferred to an opportune moment.** `freelancer.ts` now derives the unsupported set from `Object.values(ns.enums.CodingContractName)` — so it cannot drift from the game and self-updates if Bitburner adds a type — publishes `{ completed, failures, unsupported }` to `playerData.contracts`, and `dashboard.ts` renders a CONTRACTS panel listing the unsupported types in error styling. `mapper.ts`'s default export now takes `CodingContractName` and returns `null` for unmapped types, removing the `as keyof typeof algorithms` cast at the call site. Maintainer: "Because of its visibility, I'm confident I'll fix it at an opportune time." In BACKLOG. Rewards for these five still accumulate uncollected; handling remains graceful (blacklisted without consuming a try). Original: 5 of 30 contract types have no solver: `Minimum Path Sum in a Triangle`, `Find All Valid Math Expressions`, `Compression III: LZ Compression`, `Total Number of Primes`, `Largest Rectangle in a Matrix`. Checked against `CodingContractSignatures` in the `.d.ts`; all 25 present keys byte-match (including `Vigenère`). Handling is graceful — `freelancer.ts:33` returns `null`, `:61` blacklists without consuming a try — so the cost is only uncollected rewards, but those contracts accumulate on the network forever |
| N5 | Low | `contracts/algorithms.ts:181-188` | **FIXED.** `if (num === f) return num;` added *inside* the `while`, so the last division that would take `num` to 1 returns `f` instead — `f` ascends and all smaller factors are already divided out, so it is the largest prime factor. Placement is load-bearing: before the `while` the guard is unreachable, since the for-guard `f * f <= num` with `f >= 2` forces `num >= f² > f`. Verified: exhaustive over [2, 2×10⁶] 0 wrong; 10⁶ random over [2, 10⁹] 0 wrong; 3×10⁵ heavily-composite (repeated largest factor — the exact trigger) 0 wrong; `lpf(1)`, `lpf(2)`, powers of two and large primes all correct. Original: returned 1 when the largest prime factor divided out completely. The function returns the remaining quotient rather than the last successful divisor, and the bound `f * f <= num` is re-evaluated against the shrinking `num`. Fires exactly when the largest prime factor has multiplicity ≥ 2. **Verified by execution:** `lpf(4)=1` (want 2), `lpf(9)=1` (3), `lpf(100)=1` (5), `lpf(1e9)=1` (5); `lpf(12)=3` and `lpf(999999937)` are correct. Fuzzed 200,000 integers in `[500, 1e9]`: 0.119% wrong, ~1 in 840 contracts of this type |
| N7 | Low | `broker/trader.ts:147-149` | Commission dropped from the running balance, and shares credited on a failed buy. `buyStock` returns the **per-share** price, so `moneyToSpend -= shares * price` omits the $100k commission that `getPurchaseCost` (used by the binary search at `:30`) does include — drift of $100k per order. Worse, `positions[sym][0] += shares` (`:148`) is unconditional: `buyStock` returns `0` on failure, and the order is *sized* in one helper process and *placed* in another (`ns.run` per call), so the stock can tick between them. On failure `moneyToSpend` isn't decremented and positions are credited with shares never bought — that table feeds `$getPortfolioValue` (`:153`) → `moneyData.estimatedStockValue` → `goals.ts:179`'s `estimatedStockValue + money`, so the goal engine can believe an aug batch is affordable when it is not. Self-corrects on the next `nextUpdate` (~6s); the $1B floor in `getRequiredReserves` makes money exhaustion unlikely |
| N8 | Low | `broker/trader.ts:82,88` | $30B spent at service start with no reserve or goal check. `purchaseTixApi()` ($5B) and `purchase4SMarketDataTixApi()` ($25B) fire the instant the service starts; neither consults `getRequiredReserves`, which the same file defines and applies to the much smaller share purchases at `:141`. Player at $31B with an `INSTALL` root and a $30B `AUG_MONEY` prerequisite: `couldTrade()` (`services.ts:59`) is true on the money test alone, trader drains to ~$1B, and the install slips by hours. Same class as C9 |
| N9 | ~~Low~~ | `broker/trader.ts:56-70` | **WITHDRAWN — not a defect, either claim.** Maintainer confirmed in-game that `getSaleGain(sym, 0, 'L')` returns **0**, so there is no commission bias and nothing was ever mis-valued. The efficiency fallback was also wrong: `$getPortfolioValue` is a *single* `runInPlace` callback with the loop inside it — one helper process making 33 ordinary in-process calls, not 33 helper launches (`nerd.ts:175-179` is likewise plain direct calls). A `shares > 0` filter would save ~33 cheap function calls per pass; not worth a change. Also confirmed: `getSaleGain` returns a **negative** value for 1 share, which retroactively **validates** the `getSaleGain(...) > 0` guards at `trader.ts:120,130` — they prevent selling a dust position for less than the $100k commission. Consequence: a position worth under commission is never liquidated, including in `dumpMode`; holding it is cheaper, so this is correct as written. Original claim below, retained for the reasoning trail. ~~Scope corrected on re-read — larger than first logged.~~ (a) `nerd.ts:175-179` has the same unfiltered pattern *doubled* (long + short per symbol, so up to −$6.6M vs trader's −$3.3M), and `nerd.ts:182` feeds it straight into `if (estimatedStockValue + money < 200e6) ns.singularity.softReset('start.ts')` — an understated portfolio can trigger a **soft reset**. Bias is ~3% of that threshold, so it bites only near the boundary. (b) `estimatedStockValue` has **four** decision consumers, not one: `angel.ts:231` and `tree.ts:397` (`liquidAssets`), `tree.ts:550` (`augMoneyGoal` for the blade price), `goals.ts:179` (BN8 4S goal), plus `dashboard.ts:65` display. Any fix must cover both writers. Original: portfolio value summed over symbols with zero shares. `$getPortfolioValue` calls `getSaleGain(sym, positions[sym][0], 'L')` for all 33 symbols; the display at `:168` correctly filters `> 0`. `getSaleGain` accounts for commission, and `:120`/`:130` guard on `getSaleGain(...) > 0` precisely because it can be non-positive — so a zero-share symbol plausibly contributes `-StockMarketCommission`, biasing `estimatedStockValue` by up to −$3.3M, most visibly in the pre-4S branch at `:92-95`. **Needs one in-game check** of `getSaleGain(sym, 0, 'L')`; the fix (filter to `> 0` shares) is correct either way and removes 28 wasted calls |
| N6 | Low | `contracts/freelancer.ts:38` | The failure diagnostic prints mutated input. The one line that exists to make a broken solver debuggable prints `JSON.stringify(data)` *after* `algorithm(data)` has run; `countPaths`, `fewestHops`, `spiralizeMatrix`, `mergeIntervals` and `twoColor` all mutate their argument. A failed Spiralize Matrix logs `spiralizeMatrix([[],[],[]]) => …`. Very likely why `tests.ts` had to hardcode its input by hand |
| N10 | ~~Low~~ | `contracts/algorithms.ts:289-300` | **WITHDRAWN — not a defect.** Maintainer confirmed in-game that the Vigenère text contains no spaces, so there is nothing to pass through. The inference that Caesar and Vigenère share a plaintext generator was wrong: the Caesar generator emits two space-separated words and needs its guard, the Vigenère one does not. The asymmetry between the two solvers is a correct response to different inputs. Original: `vigenereCypher` has no space passthrough. `caesarCypher:285` has `c === ' ' ? c : …`; the Vigenère solver has no equivalent, and `cypher(' ', shift)` produces `(shift - 33) % 26 + 65`, a control/punctuation byte. `vigenereCypher(['ARRAY CACHE','LINUX'])` → `LZEUV+KNWEP`; the game's cipher passes spaces through while advancing the key index, exactly as `pwChar()` here does, yielding `LZEUV KNWEP`. **Needs one in-game check** — only reachable if the game's plaintext contains spaces; the asymmetry with the Caesar solver is the only offline evidence |
| N11 | Low | `broker/dump.ts:4,17-23` | Silent failure and a stale message. `main` wraps all of `dump(ns)` in try/catch and reports only to `console.error` (devtools, invisible in game). A throw on the first symbol means **nothing is sold**, the process exits 0, and `usr/liquidate.ts:13`'s `await rmi(...)` sees a clean exit and reports success. Separately `:4` prints "setting reserve proportion to 100%" — nothing sets any reserve proportion; leftover text |
| N12 | Low | `contracts/freelancer.ts:56` | Full re-scan every second, including blacklisted contracts. `getContracts` runs three `inPlace` helpers (three `ns.run` + port round-trips + `ramOverride` shrink/restore each) for every `.cct` on the network every 1000 ms, including contracts in `failures` that will never be attempted again. With ~10 contracts that is ~30 helper processes per second, permanently, for a table whose only fresh column is `tries`. Same class as H22 / `pool.ts:157` |

### Solver blast radius

`freelancer.ts:36` submits the wrong answer, burning one of 10 tries, and `:61` blacklists the contract for the life of the service. `failures` is module state, so every service restart retries and burns another try; after 10 the contract self-destructs.

### Solvers verified correct

Fuzzed against reference implementations, 0 failures: `computeSumPermutations`, `computeSumPermutationsII`, `maximumSubarraySum`, `fewestHops`, `mergeIntervals`, `spiralizeMatrix` (incl. 1×n / n×1 / even and odd), `pathToCorner` (BFS-optimal and path-valid), `generateIPs`, `fixParensOpt`, `hammingEncode` + `hammingCorrect` round-trip with single-bit corruption at every position, `lzDecode`, `rle` (incl. runs > 9), `caesarCypher`, `vigenereCypher` without spaces, `squareRoot` (closest-integer property). `stockProfit` matches the standard k-transaction DP for k = 1..5 and `Infinity` — the `i = 2` split floor is sound because any optimal first transaction ends at index ≥ 1. Timings acceptable: `stockProfit(50 prices, k=10)` 5ms; `fixParensOpt` 29ms at 20 chars (286ms at 24, above the game's generated length).

### `bin/hacknet.ts` — consequence of the R1 finding

R1 flagged `:16`'s missing `await` as style/latency. Combined with `:31`'s successful-purchase path it is a **fully unyielded loop**: success at `:31` falls through to `while (true)` → unawaited `ns.sleep(10000)` → `:19` with no yield anywhere. It self-limits only because each purchase drains money to the `else` branch's `await ns.sleep(1000)`. A zero-cost purchase from `getBestPurchase` would be a hard tab freeze. Also `:41`'s `catch` swallows the error with no print. All moot while the service is unreachable.

### R6 notes for later units

- **`.rip` bracket discipline is 12-for-12 in units 11/12, 19-for-21 repo-wide.** The only two historical violations (W1, W9) were in `lib/sing.rip.ts`; both closed. The pattern that keeps these clean is visible in `burners.rip.ts:143-147`: everything that would have been a closure (`SKILL_LIMITS`, `LIMITATIONS`, `stamina`) is consumed *outside* the callback and only the resulting arrays are passed in. Worth citing when unit 13 audits `mole.ts`'s manual `ramOverride` dance
- **The `inPlace` reservation table is complete for four of the six heavy users** — `burners.ts` (5GB×mult singularity), `don.ts` (4GB gang), `freelancer.ts` (10GB codingcontract), `trader.ts` (2.5GB stock), all exact. `sleeves.ts` (P1) remains the only known mismatch. `bin/corp/*` is audited (unit 10, adequate); `bin/dnet/mole.ts` (unit 13) is the last unaudited user, and it does its own `ramOverride` rather than going through `in-place.ts`, so the cross-namespace check won't apply directly
- **`bin/gang/task-table.ts` joins `bin/phil.ts` (C15) as a manual CLI tool sitting in `bin/`.** If unit 14 does a `usr/` sweep, these are one relocation
- **`moneyData.estimatedStockValue` has two writers and one real consumer.** `trader.ts:94,154` writes it, `dump.ts:14` zeroes it, `goals.ts:179` adds it to `money` when pricing `moneyPrereqGoal`. Any over- or under-statement (N7, N9) lands directly on the install decision. Unit 14's `usr/liquidate.ts` is the other end of that path
- **`bin/contracts/` has no test coverage at all** and `tests.ts` is dead. The solvers are the cheapest thing in the repo to test — pure functions of plain data, no `ns` needed, short reference implementations — but **unit 15 must not add them yet**: maintainer has sequenced this after the thief changes so the suite output stays readable while the goal-engine and thief tests are the ones being read. In BACKLOG
- **`getResetInfo().ownedAugs` is a `Map` passed through an `inPlace` port** (`burners.ts:75`). ~~This works because ports store values by reference~~ — **CORRECTED R6:** ports **clone with `structuredClone()`** (`.d.ts`, `NetscriptPort.write`). Verified: `Map`, `Infinity` and plain objects survive as *copies*; **`Promise` and functions throw `DataCloneError`**; class instances silently lose their prototype and methods. So the Map survives via structuredClone, *not* because of `lib/ports.ts`'s Map reviver — `in-place.ts:92,102` uses raw `ns.writePort`/`ns.readPort`, bypassing `lib/ports.ts` entirely. Same reason `Infinity` survives from `getActionCountRemaining` in `burners.rip.ts:50`. Relevant if anyone considers routing `in-place.ts` through `lib/ports.ts`, whose `:9` JSON round-trip turns `Infinity` into `null` (F15)

## Unit 13 — mole (1006 lines)

| File | Status | Notes |
| --- | --- | --- |
| `bin/dnet/mole.ts` | — | Largest file in the repo |

## Unit 14 — dnet rest + usr + root (1123 lines)

Low-effort sweep, not a deep review. `usr/` files have no cross-imports and average 23 lines.

| File | Status | Notes |
| --- | --- | --- |
| `bin/dnet/data.ts` | — | |
| `bin/dnet/dnet.ts` | — | |
| `bin/dnet/ports.ts` | — | |
| `books.ts` | — | |
| `download.ts` | — | Generated by `make-download.js`. R1: `:47,66` list `/bin/self/buy-ram.ts` and `/boot/data.ts`, neither exists |
| `readme.ts` | — | |
| `start.ts` | — | |
| `stop.ts` | — | |
| `update.ts` | — | |
| `usr/bitflume.ts` | — | |
| `usr/data.ts` | — | |
| `usr/eval.ts` | — | |
| `usr/hass.ts` | — | |
| `usr/liquidate.ts` | — | |
| `usr/make-cct.ts` | — | |
| `usr/nmap.ts` | — | |
| `usr/path.ts` | — | |
| `usr/read.ts` | — | |
| `usr/recon.ts` | — | |
| `usr/reset.ts` | — | |
| `usr/servers.ts` | — | |
| `usr/services.ts` | — | R1: `:30` `id === target` number-vs-string always false; `:24` bare string statement; `--force` is inert (F8) |
| `usr/suite.ts` | — | |
| `usr/tail.ts` | — | |
| `usr/wipe.ts` | — | |

## Unit 14 — dnet rest + root + `usr/` · reviewed R7

### The downloader — H1, H2, H3, M2 all closed by one rewrite (82e6ba0, 7eefa47)

Four findings shared a root cause: a **committed generated manifest** (`home/download.ts`, 147
entries, produced by `make-download.js`) that nothing verified. All four are now unreachable by
construction rather than fixed textually.

- **H1** — `download.ts:153` guarded on `ns.args[0]`, but `ns.flags()` does not consume `ns.args`
  (the `.d.ts` examples return positionals in `_` precisely because `args` keeps everything). So
  `--branch main` made the installer print `Unrecognized parameter(s)` and exit. Verified against
  the `.d.ts` flags contract.
- **H3** — `update.ts:11` fetched `${branch}/download.js` from the **repo root**, deleted in
  `6754d8d "Moving download.js to home folder"`. The `wget` return was discarded, so it failed
  silently. Verified: the file is absent locally, and `package.json`'s `"main"` carried the same
  stale name.
- **Combined, `update` had never worked since that move** — it stopped the OS, failed to refresh
  the installer, failed to run it, and restarted the old code with no signal. That is *why* H2 and
  M2 were free to drift: nobody could successfully re-run the downloader.
- **H2** — `make-download.js:11-13` put the `log`/`tmp` exclusion on the *recursion* branch, so both
  directories fell through the `else` and were emitted as leaf entries (`download.ts:127,131`).
  Position mattered: `'log'` sat at entry 127 of 147, immediately before `readme.ts`, `start.ts`,
  `stop.ts`, then `'tmp'`, then `update.ts` and all 20 `usr/` tools — so if `wget` threw on an
  extension-less target, a fresh install would have ended without `start.ts`.
- **M2** — three listed files no longer existed (`/bin/self/backdoor.ts`, `/bin/self/hack.ts`,
  `/lib/factions.ts`). Verified both directions; the reverse was clean. This was the *second* drift
  of the same kind, the first being R1's `/bin/self/buy-ram.ts` and `/boot/data.ts`.

**Resolution.** `download.ts` now asks the GitHub tree API for the file list
(`api.github.com/repos/…/git/trees/main?recursive=1`) and filters `type === 'blob'`. Verified
before writing: CORS `access-control-allow-origin: *`, 142 blobs matching disk exactly in both
directions, `truncated: false`, no double-slash URLs (the old form cost a 307 per file), and no
directory entries possible. Maintainer confirmed CORS works in both Electron and Web builds.
`make-download.js` and the `start` script are deleted; branch support dropped (trunk-based
anyway), which removes the flag parsing H1 depended on. Every `wget` and the `exec` are now
checked, an empty file list aborts, and failures are listed by name.

Maintainer additions during testing, both things offline review could not have found:
`--wipe` moved into `download.ts` and sequenced **after** the tree fetch succeeds (don't delete
until the replacement is known reachable), and `ns.read(DOWNLOAD)` in `update.ts` to invalidate
the in-game file cache — without which `update` would have re-run the stale copy.

Open nits: `download.ts:24` names `RAW_ROOT` in the "Fetching file tree" message when the tree
comes from `TREE_URL`; `update.ts:22` passes an empty-string arg when `wipe` is false
(`...(wipe ? ['--wipe'] : [])` sends nothing) — harmless today, but it is H1's shape.

### M1 — WITHDRAWN

Claimed `ns.ls('home', '/bin/dnet/')` returns `[]` because of the leading slash, leaving
`dhud.tsx` undeployed. **Wrong** — the maintainer verified in game that the *filter* argument
tolerates a leading slash; only returned *values* are unslashed. R1's F4 was about interpreting
returned values (`scriptRam` keyed from `ns.ls` output), which is a different case; the agent
conflated the two and the reviewer repeated it. `dnet.ts:170` and `:75` are consistent with the
house convention, not contradictions. See the charter's "File paths and the leading slash".

### Lows (not individually verified)

L1-L3 `usr/services.ts` — `:30` `id === target` number-vs-string always false (only `tail` by
numeric id diverges; enable/disable use `==` at `service.ts:88` and work); `:24` dead bare string;
`:25,26` unawaited async `enableService`/`disableService`, dropped silently if the port is full;
`--force` still inert. L4 `bin/dnet/ports.ts:16` `port.empty()` where `clear()` is meant — latent,
the whole writer half is a dead duplicate of `mole.ts`'s local copies. L5 `dnet.ts:62,65` maze
render over-sized by one row/column (verified by execution; blank border, not a crash).
L6 `dnet.ts:204` unguarded division by `onlineRunningTime` — `Infinity` survives `lib/ports.ts`'s
replacer and would poison `totalIncome`. L7 `bin/dnet/data.ts:8` `Object.entries` over the
`NULL PORT DATA` string prints character rows. L8 `books.ts:21` `books <query>` prints nothing.
L9 `readme.ts:29` `config` alias targets a non-existent script; `:110` `services` is dead
(overwritten by the spread at `:119`); `:54` `lr`'s description is copy-pasted from liquidate.
L10 `usr/tail.ts:19-21` missing `return` emits a second contradictory error. L11 `usr/recon.ts:6`
debug `tprint` of the whole accumulated blob on every `getData` call (2-3× per hop × 15 hops, and
a bare empty line when the file is absent) — **open**, pure residue; the intended output is at
`:49`. The Stanek half is **NOT a defect**: the whole tool is destructive by design — it leaves
the BitNode to gather data, so accepting the Gift is functionally reversible (no progress remains
to lose) and there is no interaction with the Bladeburner join rule, since `recon` is never part
of normal operation. A confirmation prompt has been added, gated on `timeSinceReset > 10000` so it
asks once when the player starts it and stays silent across the 14 automatic `b1tflum3` hops,
each of which resumes with a fresh `lastNodeReset`. `b1tflum3(nextBN, callbackScript?)` forwards
no args, so `--wipe` cannot leak into later hops. L12 `usr/data.ts:20-22` raw `TypeError` on a bad path.

### Verified correct — do not re-review

Layering invariant holds: nothing in `bin`/`boot`/`lib`/`etc` imports from `usr`. `dnet.ts` cache-money
parsing and versioning both verified by execution. `stop.ts:28-45` is the sanctioned time-based
yield. `bin/dnet/ports.ts` RMW races are safe (no `await` between read and write).
`usr/servers.ts:10-12` is a correct stable multi-key sort. `usr/path.ts` uses `navigator.clipboard`,
not the DOM. Ten `usr/` tools plus `start.ts` clean.

### Relocation answer (M4 / C15)

Clean. `bin/gang/task-table.ts` has no imports at all; `bin/phil.ts`'s `../lib/*` specifiers are
unchanged at `usr/`'s depth; neither is referenced anywhere. `bin/dnet/data.ts` is a third
candidate (needs one import rewrite and a rename to avoid colliding with `usr/data.ts`).

### Note for unit 15

`lib/test/data/BN4-mock.ts` (132KB) is downloaded to `home` on every install — relevant to the
parked "test fixture bundling" concern.

## Unit 15 — Test infra · reviewed R8

Reviewed by **mutation testing** — reintroducing known defects into production code and checking
whether the suite went red. That is the only method that answers the question this unit poses, and
it makes R8's findings the most directly evidenced of the review. Baseline offline: 68 pass, 0
fail, 1 skip (four of five suites run outside the game with a stub `ns`; `test/formulas.ts` needs
the real `ns.formulas`).

### The suite's reach is 7 production files

Measured with `esbuild --metafile` on `run-all.ts`: `lib/aug-select.ts`, `lib/aug-weights.ts`,
`lib/formulas.ts`, `lib/goals/nodes.ts`, `lib/goals/tree.ts`, plus `data-store`/`ports`/`colors`/
`etc` as plumbing. The other ~130 reviewable files are unreachable.

**`lib/goals/goals.ts` is not among them** — the goal engine's entry point and the highest-defect
file of units 1-2. G1, G2, G5, G7, G9 and G10 all live there, and the suite tests the layer
directly beneath it. That single gap explains most of the coverage table below.

### High

- **H1 `goal-tree.ts:105-121` — neither dep-composition test composes anything.** "returns the max
  across parallel deps" has no parallel deps; its own comment concedes it ("factionRepGoal only
  takes one dep… Verify by checking each independently") and its two assertions are independent
  single-goal checks. "sums depsMax + ownTime" passes an *already-joined* faction, so `depsMax` is
  0 and the sum is `0 + 100`. **Verified:** flipping `Math.max`→`Math.min` at `nodes.ts:137` leaves
  all 39 goal-tree tests green. Every faction plan would report its *shortest* prerequisite;
  `angel`, `sysadmin` and `love` all amortise against that number.
- **H2 `aug-scoring.ts:114-126` — `assert.deepEqual(sort(), sort())` is a tautology.** Both calls
  sort a fresh copy of the same array with the same comparator. **Verified:** holds with every
  `utility` set to `NaN` — exactly the `by()` degradation the charter documents — and with a
  constant-0 comparator. The one test that looks like an ordering guard is not one.
- **H3 `formulas.ts:184-191` — the drift suite conceals the drift it exists to find.** It passes
  `prodMult` to the real API but not to the mock, so they agree by construction — and the missing
  4th argument *is* S5. Compounded by an inversion: the file needs Formulas.exe to run, but
  production uses the mock only when Formulas.exe is **absent**, so the mock is compared against
  reality exactly when it is dead code. S5 and S11 both sit in that gap.

### Medium

- **M1 `run-all.ts:8-12` — no per-suite isolation.** Only code inside an `it()` body is caught; a
  setup-level throw aborts the whole run. **Verified:** a throw in `aug-scoring`'s setup produced
  zero output from all five suites. The dangerous variant is a throw in the *last* suite — four
  print green and the run looks plausible.
- **M2 `test-runner.ts:81-104` — the runner counts nothing.** No tally, no status line;
  `runSuite()` resolves identically for 0 or 40 failures. With M1, "the suite printed less than
  usual" is the only signal that something structural broke.
- **M3 `run-sequencing.ts:44` — the suite's most expensive test changes implementation with the
  player's inventory.** `getFormulas` returns the *real* `ns.formulas` when Formulas.exe is owned.
  `faction-selection.ts:15-17` deliberately pins the mock and says why; this file does not. The
  same commit can pass on one save and fail on another.
- **M4 `data/BN4-mock.ts` — the fixture has drifted from `StaticData` and nothing checks it.**
  No type annotation, every consumer casts `as any`. **Verified independently:** adding
  `: StaticData` yields TS2739 — missing `scriptRam`, `purchasedServerLimit`,
  `purchasedServerMaxRam`, `purchasedServerCosts`, `startingServerValue`, plus faction tables
  missing `Bladeburners`, `Church of the Machine God` and `Shadows of Anarchy`. Consequence:
  `getAccessibleFactions` always appends `Bladeburners`, which the fixture cannot describe — so
  the S6 rep-rate path is untestable against it. `fixtures.ts:93` has the same hole via a double
  cast. The round-4 `singularityData` grouping itself is correctly reflected; field coverage is not.
- **M5 — seven already-fixed defects reintroduced; all 68 tests stayed green.** S1 (R2 High),
  S2 (R2 High, maintainer-verified), S3, G3 (fixed days earlier), G4, `isRepBound`'s `<=`→`<` tie
  case, and `aug-select.ts:158`'s `canDonate` boundary. That last one is instructive: `canDonate`
  exists **twice** (`aug-select.ts:158` and `tree.ts:453`) and the tests pin only the second —
  mutating that copy correctly fails two tests.

### Low

L1 `run-sequencing.ts:104` stale `it.skip` (its subject, S7's Netburners gate, was removed);
L2 `console.log` diagnostics invisible in game; L3 `uniqueLeft` never subtracts `augsObtained`
(always prints 98); L4 the DataJack test has no `assert`; **L5** `run-sequencing.ts:21-99` and
`faction-selection.ts:41-122` are two ~80-line **reimplementations** of the production selection
loop — including a third copy of the prereq-ordering block R2 deleted from `tree.ts` — so the real
loop can diverge from the tested one silently; L6 dead guard; L7 `assert.throws` accepts any throw;
L8 `assert.equal` is exact float equality where `assert.close` exists; L9 output order ≠ source
order; L10 duplicate `describe` names merge silently; L11 `test.ts` is a dead demo containing a
deliberately-failing test — and the file a newcomer opens first; L12 `expect` throws
'Not supported yet'; L13 two tests restate their implementations (comments say this is intended);
L14 `factionEnemies = {}` lets the BN4 run take augs from all six city factions in one cycle,
which the game forbids, under the one test modelling a realistic run.

### Coverage against R1-R7

**Caught** (verified by mutation): S4, the `1.9^numQueued` offset in `computeAugCost`, `tree.ts:437`'s
`numQueued` vs `numOwned`, `computeRepReq`'s max-vs-sum, `assertFinitePositive` on
`totalIncome`/`repRate`, `scoreAug`'s per-stat direction, `tree.ts:453`'s `canDonate`, `UNPRICEABLE`
propagation through a single dep.

**In closure but missed:** S1, S2, S3, G3, G4, `isRepBound`'s tie, `aug-select.ts:158`'s
`canDonate`, `nodes.ts:137`'s parallel-dep max.

**Out of reach:** all of `goals.ts` (G1, G2, G5, G7, G9, G10); unit 1 substrate (F1, F2, F5, F12,
F15, F17); `by()`'s NaN degradation; the entire R7 RAM redesign; all of `bin/` — thief, angel,
sysadmin, sleeves, love, corp, don, trader; and `bin/contracts/algorithms.ts`, whose solvers are
the cheapest thing in the repo to test and have zero coverage.

**Highest leverage, in order:** a genuine parallel-dep test; an end-to-end `getGoals` test; solver
coverage; annotate `BN4-mock.ts` as `StaticData` and drop the `as any` casts.

### Verified correct — do not re-review

`isDeepEqual`'s `Object.is` base and key-count check; `assert.close`'s relative tolerance with an
absolute floor; the runner awaits async tests and catches their rejections; `describe` nesting;
`it.skip` prints without executing; `mockStaticData`'s `EMPTY_SINGULARITY_DATA` defaulting and its
stated rationale. BN4-mock is **internally** consistent (99 aug names, four aug tables with exactly
those keys and no orphans either way, every offered aug known, all prereq targets present, four
faction records covering the same 31 factions). `faction-selection.ts:259,276` is a correct
replacement for R2's bug-encoding test at the old `:245` — **no other bug-encoding fixture was
found** in the four runnable suites; H3 is the remaining instance and it is in `formulas.ts`.

### `usr/cct-battery.ts`

Built during R8 as the N3 replacement: generate N dummy contracts per type via
`createDummyContract`, solve, `attempt`, report only failures. The game's generator is the real
input distribution and `attempt` is a real oracle — better than a hand-written table, since both
R6 solver bugs were *distribution* questions. Two defects caught in review: `attempt`'s result
tested with `== null` when `.d.ts:4056` documents an **empty string** on failure (so it reported
100% pass for every solver, including the known-broken ones), and `${inputCopy}` without
`JSON.stringify`, which flattens `[4,[[0,1],[2,3]]]` to `4,0,1,2,3`. Moved from `lib/test/` to
`usr/` — it is a manually-run tool, not a suite entry, and `lib/` importing `bin/contracts/mapper`
would have been the second `lib → bin` violation. **Open:** the original copy at
`lib/test/cct-battery.ts` still exists and is tracked — identical apart from import depth, and the
8th file in knip's unused list.

## Unit 15 — Test infra (1767 lines)

Sequence after the `scripts/test-*.ts` → `home/lib/test/*.ts` migration settles.

| File | Status | Notes |
| --- | --- | --- |
| `lib/test-runner.ts` | — | |
| `lib/test/aug-scoring.ts` | — | |
| `lib/test/faction-selection.ts` | — | |
| `lib/test/fixtures.ts` | — | |
| `lib/test/formulas.ts` | — | |
| `lib/test/goal-tree.ts` | — | |
| `lib/test/run-all.ts` | — | |
| `lib/test/run-sequencing.ts` | — | |
| `lib/test/test.ts` | — | |
