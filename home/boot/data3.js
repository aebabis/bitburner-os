import { getStaticData, putStaticData } from './lib/data-store';
import { defer } from './boot/defer';

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('Determining required job RAM');

    const { bitNodeN, ownedSourceFiles, scriptRam } = getStaticData(ns);

    const hasSourceFile4 = ownedSourceFiles.some(file=>file.n === 4);

    // Compute RAM required on job server
    let requiredJobRam = null;
    if (bitNodeN === 4 || hasSourceFile4) {
        const maxScriptSize = Math.max(...Object.values(scriptRam));
        requiredJobRam = 1;
        while (requiredJobRam < maxScriptSize)
            requiredJobRam *= 2;
        ns.tprint(`Job RAM Required: ${requiredJobRam}GB`);
    }

    putStaticData(ns, { requiredJobRam });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}