import { resolve, relative } from 'path';
import { writeFile, readdir } from 'fs/promises';
import EventEmitter from 'events';

/** @param {string} dir @returns {AsyncGenerator<string>} */
async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory() && !['log', 'tmp'].includes(dirent.name)) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

const eventEmitter = new EventEmitter();

const toBitburnerPath = (/** @type {string} */ file) => {
  const fullpath = relative('home', file).replace(/\\/g, '/');
  if (fullpath.includes('/')) return '/' + fullpath;
  return fullpath;
};

async function go() {
  const files = [];
  for await (const f of getFiles('home')) {
    const bitburnerPath = toBitburnerPath(f);
    const item = `  '${bitburnerPath}',`;
    files.push(item);
  }
  const program = `const FILES = [
${files.join('\n')}
];

export async function main(ns: NS) {
  const { branch } = ns.flags([['branch', 'main']]);
  if (ns.args[0] != null) {
    ns.tprint('\\u001b[31mUnrecognized parameter(s): ' + ns.args[0] + '. To set a branch use --branch BRANCH');
    return;
  }
  for (const file of FILES) {
    const downloadPath = \`https://raw.githubusercontent.com/aebabis/bitburner-os/\${branch}/home/\${file}\`;
    await ns.wget(downloadPath, file);
    ns.tprint(\`Downloaded \${file}\`);
  }
  ns.tprint('Download complete');
}`;
  await writeFile('home/download.ts', program);

  eventEmitter.emit('done');
}

eventEmitter.on('done', () => {
  console.log('done');
});

go();
