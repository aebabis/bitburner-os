import { stop } from './stop';
import { ERROR, INFO } from './lib/colors';
import { tprint } from './boot/util';

const DOWNLOAD = '/download.ts';
const DOWNLOAD_URL = 'https://raw.githubusercontent.com/aebabis/bitburner-os/main/home/download.ts';

export async function main(ns: NS) {
  const { wipe } = ns.flags([['wipe', false]]);
  await stop(ns);

  tprint(ns)(INFO + `  Downloading latest ${DOWNLOAD}`);

  if (!(await ns.wget(DOWNLOAD_URL, DOWNLOAD, 'home'))) {
    tprint(ns)(ERROR + `  Unable to download ${DOWNLOAD}`);
    return;
  }

  // Reading new file invalidates in-game cache
  ns.read(DOWNLOAD);

  const pid = ns.exec(DOWNLOAD, 'home', 1, ...(wipe ? ['--wipe'] : []));
  if (pid === 0) {
    tprint(ns)(ERROR + `  Could not start ${DOWNLOAD}. The OS is stopped and was NOT updated.`);
    return;
  }
  while (ns.isRunning(pid)) await ns.sleep(50);

  tprint(ns)(INFO + '  Restarting');
  ns.exec('/start.ts', 'home');
}
