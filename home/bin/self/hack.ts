export async function main(ns: NS) {
  try {
    ns.singularity.connect('n00dles');
    ns.print('Hacking n00dles...');
    ns.print(await ns.singularity.manualHack());
  } catch (error) {
    console.error(error);
  }
}
