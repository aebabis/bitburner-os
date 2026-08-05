# aebabis/bitburner-os

## General Design Principles
- The planner is a core aspects of the OS. It makes the OS architecture more declarative and the code more lightweight. While it introduces more surface area for race-conditions and bottlenecks, it provides flexibility when dealing with different BitNode combinations and provides a fun challenge (this is a game after all).
- The deferred execution of scripts using the `rmi` API allows "programs" to be run in a piecemeal fashion to get around RAM constraints.
- While having different top-level scripts for different BitNodes and configurations is occasionally useful (e.g. in the bootloader), it is to be avoided where possible. Instead, the services make decisions based on constraints and farm out work accordingly.
- `globalThis` and the DOM API are used for visualizers and profiling tools but avoided for game automation. An exception to this is using event listeners to handle focus without flickering. Requiring manual play for BN1.1 is an intential decision.

## File System
- `etc` holds constants only — port numbers, script paths, tunables, static aug data. No `ns` usage.
- `lib` holds shared libraries. It does not import from `bin`.
- `boot` runs once per reset (or when manually triggered). It populates the data stores before executing the planner
- `bin` contains services and worker scripts
- `usr` is human-facing CLI tools. Nothing in `bin` depends on them.

## RAM
RAM is the primary architectural constraint. Most of what looks unusual in the codebase is an answer to it.
Three separate mechanisms are used to deal with RAM costs:

### Spatial — `lib/ram-router.ts`
- Finds a host with room and `ns.exec`s there.
- Best-fit: sorts eligible servers ascending by free RAM and takes the first that fits, so large servers stay free for large jobs.
- `RamPolicy.homeReserve` keeps a floor of free RAM on `home`. `HACKER_POLICY` is the hacking services' variant.

### Temporal — `lib/scheduler-delegate.ts`, `lib/rmi.ts`
- A script that can't afford an API call asks another process to make it.
- `delegateAny()` writes a job to `PORT_SCH_DELEGATE_TASK`; the planner execs it via the router.
- Jobs may carry a `ticket` (UUID). The planner writes the result to `PORT_SCH_RETURN` keyed by ticket and the caller polls for it.
- `rmi(ns)` adds "run it and block until the PID exits".
- This is what lets a "program" be assembled from pieces that never co-reside in memory.

### In-process — `lib/in-place.ts`
- `inPlace(ns)` proxies `ns`: for each non-free call it generates a throwaway script under `tmp/bin`, shrinks the caller, runs the helper, and passes args and results over a private port.
- `runInPlace(ns)(fn)` does the same for an arbitrary callback by stringifying it.
- Both use `ns.ramOverride()` to shrink static RAM by the exact amount needed by the child and restore it after the child finishes.
- The `.rip` suffix (`lib/sing.rip.ts`, `bin/corp/plan.rip.ts`) means **r**un-**i**n-**p**lace.
- Since data goes through ports, it must be data a port accepts (no Promises).
- Since scripts are generated from script text, they cannot use closures. Data must be passed in as arguments.
- Since `in-place.ts` has a RAM overhead of ~4GB, it is only used programs with multiple large API calls.

## Planner
- The Planner manages the execution of services
- Always runs on home
- Each cycle it drains the delegation queue and execs the jobs, refreshes `playerData` from live game state, checks every service, and publishes the service table and scheduler telemetry.
- Because it is the choke point for both exec and player-data refresh, its cycle time is the OS's effective clock. Anything that blocks it stalls everything.

## Services
- A Service is a supervised long-running script, declared in `bin/services/services.ts`.
- A Service has two predicates
  - `isViable()` controls the visibility of the service in the UI. It SHOULD be based on boot-time constants so it doesn't appear mid install.
  - `condition()` controls whether service should be running. If `true`, the planner will try to run it if able. If `false`, the planner will terminate it immediately.
- `getAllServices()` returns every service; the planner filters by `.isViable()`.
- Array order is start priority under RAM pressure. `services.ts` reshuffles entries for BN3 and for large-`home` cases.
- Services can be enabled and disabled at runtime over `PORT_SERVICES_REPL` (`lib/service-api.ts`). This backs the dashboard controls.
- Some services are mutually exclusive alternatives selected by `condition()`.
  - `angel` (goal-aware, needs Formulas.exe) versus `thief` (self-contained heuristics).
  - `hinter` and `trailblazer` exist only when the SF4 services in `bin/self` can't run.

## Data Stores
- `lib/data-store.ts` is the interface for storing persistent data in ports. It also contains the persistent data's type definitions.
- Used by almost every service
- Data is stored for two main reasons
  - to save RAM in other processes
  - to save derived data for reporting (e.g. number of contracts completed)
- `hostnames` is a flat list of every server, written at boot time.
- `staticData` is everything constant for an install cycle, including most singularity data, written at boot time.
- `playerData` dynamic data associated with the player, including Player, Stanek configuration, and Bladeburner stats.
- `moneyData` is per-source income rates, written by the income-producing services and used for opportunity-cost math.

## Boot Sequence
- `boot.ts` builds a chain of stages, each of which `ns.spawn`s the next.
- Stages clear ports and load data into ports.
- Taking advantage of `ns.spawn`'s ability to free RAM before starting the next script allows the boot stages to be larger.
- Stages with SF-gated APIs are excluded from the boot sequence if the condition is not met.

## Goal Engine
- The goal engine (`getGoals`) is a function that consumes data about the player and their assets to determine the progression for an install cycle.
- It returns a dependency graph
- Generally, it chooses a single faction to attempt to join and a list of augmentations to buy before installing.
- The faction and augmentations chosen are based on the utility of the augmentations (determined by a weighted scoring of their stat boosts) divided by its estimated time cost (which includes money).
- The function is functional; it is designed to be stateless and to return the same the value for the same inputs.
- The engine has a low program RAM requirement.
- Consumers of the goals graph make decisions based on antipated timing and resouce availability.
  - For example, `sysadmin` avoids buying more servers if it believes an install is imminent
- The function is called fresh anytime a consumer needs to orient itself to current objectives, as its output can change in response to unanticipated changes in player stats or assets.
- However, the goal function *attempts* to anticipate future availability of stats and resources when choosing a viable target.
- The goals engine uses the formula API when anticipating player capacity for the current install cycle. If the formula API is unavailable, it uses a simplified fallback which assumes the player is in a low BN (e.g. no Intelligence or Blades).
- The goals engine output *should* include goals for all prerequisites of joining factions. Prerequisites should be *removed* from the output once the faction is joined. (e.g. a player in the Sector-12 faction no longer needs to stay in Sector-12 or retain a balance of $10M)
- The function operates almost exlusively on analyzing weighted costs. There are few hard-code rules and no hard-gates against factions. If a faction has very high stat requirements, its weighted utility will be low, but it will not be exluded. This is to accomodate bitnode multiplier combinations not anticipated.
- A `resetOverhead` calculation is added to the base setup time for the purposes of analysis. This is a base value divided by number of augs installed, simulating how "getting up to speed" takes less time after a few installs. This term should be replaced if formula use becomes more sophistocated. (TODO)

## Vocabulary
- The NS API uses "purchasedAugmentations" to refer to both installed augs and augs purchased during the current run. The OS code uses the term `installedAugmentations` for augmentations the player started an install cycle with and `queuedAugmentations` to refer to augmentations purchased during the current install cycle. `ownedAugmentations` refers to all augmentations purchased whether installed or not (the union of installed and purchased).
- An *install cycle* is the span between two aug installs; a *node reset* is entering a new BitNode.
