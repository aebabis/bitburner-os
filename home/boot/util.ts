export const tprint = (ns: NS) => (message: string) => {
  const length = Math.max(0, 20 - ns.getScriptName().length);
  ns.tprint(' '.repeat(length) + message);
};
