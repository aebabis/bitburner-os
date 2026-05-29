export const tprint = (ns: NS) => (/** @type {string} */ message) => {
  const length = Math.max(0, 20 - ns.getScriptName().length);
  ns.tprint(' '.repeat(length) + message);
};
