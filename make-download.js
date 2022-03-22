const { resolve, relative } = require('path');
const { readFile, writeFile, readdir } = require('fs').promises;
const EventEmitter = require('events');

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
}

async function go() {
  const instructions = [];
  for await (const f of getFiles('home')) {
    const bitburnerPath = toBitburnerPath(f);
    const content = await readFile(f);
    const src = content.toString().replace(/`/g, '\\`').replace(/\$\{/g, '\\\$\{');
    const instruction = `await ns.write('${bitburnerPath}', \`${src}\`, 'w');`;
    instructions.push(instruction);
  }
  const program = `export async function main(ns) {\n${instructions.join('\n')}\n}`;
  await writeFile('download.js', program);
  
  eventEmitter.emit('done');
}

eventEmitter.on('done', (files) => {
  console.log('done');
});

go();

