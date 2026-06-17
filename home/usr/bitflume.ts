export async function main(ns: NS) {
  const [nextBN, startScript = 'start.ts'] = ns.args as [number, string?];
  ns.singularity.b1tflum3(nextBN, startScript);
}
