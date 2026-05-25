# aebabis/bitburner-os

## General Design Principles
- The scheduler and planner are core aspects of the OS. They make the OS architecture more declarative and the code more lightweight. While they also introduce more surface area for race-conditions and bottlenecks, these are considered fun challenges to solve (this is a game after all) and give the OS a unique character.
- The deferred execution of scripts using the `rmi` API allows "programs" to be run in a piecemeal fashion to get around RAM constraints.
- While having different top-level scripts for different BitNodes and configurations is occasionally useful (e.g. in the bootloader), it is to be avoided where possible. Instead, the services make decisions based on constraints and farm out work accordingly.
- Storing data in `globalThis` and using non-NS APIs are okay for the purposes of visualizers and profiling tools. The are to be avoided for any code that makes in-game decisions. This is why the scheduler and thief use NS ports to coordinate. The only exception is the "stalker" service which sets player focus when the human is creating Events.

## Vocabulary
- The game uses "purchasedAugmentations" to refer to both installed augs and augs purchased during the current run. The OS uses the term `installedAugmentations` for augmentations the player started an install cycle with; `purchasedAugmentations` should only refer to augmentations purchased during the current install cycle (`ns.getPurchasedAugmentations(true)`). `ownedAugmentations` refers to all augmentations purchased whether installed or not (the union of installed and purchased).

## Goal Engine
- The goal engine (`getGoals`) is a function that consumes data about the player and their assets to determine the progression for an install cycle.
- It returns a dependency graph
- Generally, it chooses a single faction to attempt to join and a list of augmentations to buy before installing.
- The faction and augmentations chosen are based on the utility of the augmentations (determined by a weighted scoring of their stat boosts) divided by its estimated time cost (which includes money).
- The function is functional; it is designed to be stateless and to return the same the value for the same inputs.
- The engine has a low program RAM requirement.
- Consumers of the goals graph make decisions based on antipated timing and resouce availability. For example, `sysadmin` should not more servers if it believes an install is imminent.
- The function is called fresh anytime a consumer needs to orient itself to current objectives, as its output can change in response to unanticipated changes in player stats or assets.
- However, the goal function *attempts* to anticipate future availability of stats and resources when choosing a viable target.
- The goals engine uses the formula API when anticipating player capacity for the current install cycle. If the formula API is unavailable, it uses a simplified fallback which assumes the player is in a low BN (e.g. no Intelligence or Blades).
- The goals engine output *should* include goals for all prerequisites of joining factions. Prerequisites should be *removed* from the output once the faction is joined. (e.g. a player in the Sector-12 faction no longer needs to stay in Sector-12 or retain a balance of $10M)
- The function operates almost exlusively on analyzing weighted costs. There are few hard-code rules and no hard-gates against factions. If a faction has very high stat requirements, its weighted utility will be low, but it will not be exluded. This is to accomodate bitnode multiplier combinations not anticipated.
- A `resetOverhead` calculation is added to the base setup time for the purposes of analysis. This is a base value divided by number of augs installed, simulating how "getting up to speed" takes less time after a few installs. This term should be replaced if formula use becomes more sophistocated. (TODO)
