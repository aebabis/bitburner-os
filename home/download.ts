const REPO = 'aebabis/bitburner-os';
const BRANCH = 'main';
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const RAW_ROOT = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/home`;
const TREE_FILE = '/tmp/tree.json';

const ERROR = '\u001b[38;5;124m';
const INFO = '\u001b[38;5;63m';

type TreeEntry = { path: string; type: string };

/**
 * Installer for OS. Automatically pulls all program files into home folder.
 * @example
 * USAGE:
 * ```sh
 * wget https://raw.githubusercontent.com/aebabis/bitburner-os/main/home/download.ts
 * ./download.ts
 * ```
 */
export async function main(ns: NS) {
  const { wipe } = ns.flags([['wipe', false]]);

  ns.tprint(INFO + `Fetching file tree from ${RAW_ROOT}`);

  if (!(await ns.wget(TREE_URL, TREE_FILE))) {
    ns.tprint(ERROR + 'Could not fetch the file list from ' + TREE_URL);
    return;
  }

  if (wipe) ns.ls('home', '.ts').forEach((file) => ns.rm(file));

  // Program code is in /home folder of repo. Remove leading `home` so top-level files land in `/`
  const { tree } = JSON.parse(ns.read(TREE_FILE)) as { tree: TreeEntry[] };
  const files = tree
    .filter(({ type, path }) => type === 'blob' && path.startsWith('home/') && /\.tsx?$/.test(path))
    .map(({ path }) => path.slice('home'.length));

  if (files.length === 0) {
    ns.tprint(ERROR + 'Error: Empty file set');
    return;
  }

  const failed: string[] = [];
  for (const file of files) {
    if (await ns.wget(RAW_ROOT + file, file)) ns.tprint(INFO + 'Downloaded ' + file);
    else failed.push(file);
  }

  if (failed.length > 0) {
    ns.tprint(ERROR + `Failed to download ${failed.length} of ${files.length} files:`);
    for (const file of failed) ns.tprint(ERROR + '  ' + file);
    return;
  }
  ns.tprint(INFO + `Download complete (${files.length} files)`);
}
