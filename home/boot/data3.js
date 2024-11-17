import { getStaticData, putStaticData } from '/lib/data-store';
import { defer } from '/boot/defer';
import { tprint } from '/boot/util';
import { STR } from '/lib/colors';

/** @param {NS} ns */
export async function main(ns) {
    tprint(ns)(STR.BOLD + 'Determining required job RAM');

    const { resetInfo, ownedSourceFiles, scriptRam } = getStaticData(ns);

    const hasSourceFile4 = ownedSourceFiles.some(file=>file.n === 4);

    // Compute RAM required on job server
    let requiredJobRam = 32;
    if (resetInfo.currentNode === 4 || hasSourceFile4) {
        const maxScriptSize =
            scriptRam['/bin/self/aug/purchase-augs.js'] +
            scriptRam['/bin/self/job.js'] +
            scriptRam['/bin/self/work.js'] +
            scriptRam['/bin/self/tor.js'] +
            scriptRam['/bin/self/faction-work.js'];
        requiredJobRam = 1;
        while (requiredJobRam < maxScriptSize)
            requiredJobRam *= 2;
        tprint(ns)(STR + `  Job RAM Required: ${requiredJobRam}GB`);
    }

    putStaticData(ns, { requiredJobRam });

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}
