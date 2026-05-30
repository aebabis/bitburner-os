export async function main(ns: NS) {
  const [bn, script] = ns.args;
  if (typeof script === 'number' || typeof script === 'boolean')
    throw new Error('Illegal argument');
  ns.singularity.b1tflum3(+bn, script);
}
