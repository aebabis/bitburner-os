# aebabis/bitburner-os

## General Design Principles
- The scheduler and planner are core aspects of the OS. They make the OS architecture more declarative and the code more lightweight. While they also introduce more surface area for race-conditions and bottlenecks, these are considered fun challenges to solve (this is a game after all) and give the OS a unique character.
- The deferred execution of scripts using the `rmi` API allows "programs" to be run in a piecemeal fashion to get around RAM constraints.
- While having different top-level scripts for different BitNodes and configurations is occasionally useful (e.g. in the bootloader), it is to be avoided where possible. Instead, the services make decisions based on constraints and farm out work accordingly.
- Storing data in `globalThis` and using non-NS APIs are okay for the purposes of visualizers and profiling tools. The are to be avoided for any code that makes in-game decisions. This is why the scheduler and thief use NS ports to coordinate. The only exception is the "stalker" service which sets player focus when the human is creating Events.

## Vocabulary
- The game uses "purchasedAugmentations" to refer to both installed augs and augs purchased during the current run. The OS uses the term `installedAugmentations` for augmentations the player started an install cycle with; `purchasedAugmentations` should only refer to augmentations purchased during the current install cycle (`ns.getPurchasedAugmentations(true)`)
