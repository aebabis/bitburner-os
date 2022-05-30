import { getStaticData, putStaticData } from './lib/data-store';
import { defer } from './boot/defer';
import { C_MAIN, C_SUB, tprint } from './boot/util';

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(C_MAIN + 'Determining required job RAM');

    const { bitNodeN, ownedSourceFiles, scriptRam } = getStaticData(ns);

    const hasSourceFile4 = ownedSourceFiles.some(file=>file.n === 4);

    // Compute RAM required on job server
    let requiredJobRam = null;
    if (bitNodeN === 4 || hasSourceFile4) {
        const maxScriptSize =
            scriptRam['/bin/self/aug/purchase-augs.js'] +
            scriptRam['/bin/self/job.js'] +
            scriptRam['/bin/self/work.js'] +
            scriptRam['/bin/self/tor.js'] +
            scriptRam['/bin/self/faction-work.js'];
        requiredJobRam = 1;
        while (requiredJobRam < maxScriptSize)
            requiredJobRam *= 2;
        tprint(ns)(C_SUB + `Job RAM Required: ${requiredJobRam}GB`);
    }

    putStaticData(ns, { requiredJobRam });

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}