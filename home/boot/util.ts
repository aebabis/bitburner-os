export const tprint = (ns: NS) => (message: string) => {
  const length = Math.max(0, 42 - ns.getScriptName().length);
  ns.tprint(' '.repeat(length) + message);
};
