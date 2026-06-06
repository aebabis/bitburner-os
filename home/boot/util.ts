export const tprint = (ns: NS) => (message: string) => {
  const length = Math.max(0, 40 - ns.getScriptName().length);
  ns.tprint(' '.repeat(length) + message);
};
