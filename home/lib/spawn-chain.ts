import { getSpawnChain } from './service-api';

export const joinSpawnChain = (ns: NS, startScript = ns.getScriptName()) => {
  const script = ns.getScriptName();
  const { chain, maxRam } = getSpawnChain(ns);
  if (!chain.has(script)) {
    throw new Error(`${script} tried to join script chain for ${startScript}`);
  }
  if (ns.ramOverride(maxRam) !== maxRam) {
    throw new Error(`${script} tried to join ${maxRam}GB chain without extra RAM reserved`);
  }
  return {
    linkTo: async (nextScript: string, timeout = 100) => {
      await ns.sleep(timeout);
      ns.spawn(nextScript, { spawnDelay: 0 });
    },
  };
};
