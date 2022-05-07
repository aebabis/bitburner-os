import { resolve, relative } from 'path';
import { writeFile, readdir } from 'fs/promises';
import EventEmitter from 'events';

async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

const eventEmitter = new EventEmitter();

const toBitburnerPath = (file) => {
  const fullpath = relative('home', file).replace(/\\/g, '/');
  if (fullpath.includes('/'))
    return '/' + fullpath;
  return fullpath;
};

async function go() {
  const instructions = [];
  for await (const f of getFiles('home')) {
    const bitburnerPath = toBitburnerPath(f);
    const downloadPath = `https://raw.githubusercontent.com/aebabis/bitburner-os/main/home/${bitburnerPath}`;
    const command = `  await ns.wget('${downloadPath}', '${bitburnerPath}')`;
    instructions.push(command);
  }
  const program = `/** @param {NS} ns **/\nexport async function main(ns) {\n${instructions.join('\n')}\n}`;
  await writeFile('download.js', program);
  
  eventEmitter.emit('done');
}

eventEmitter.on('done', () => {
  console.log('done');
});

go();

