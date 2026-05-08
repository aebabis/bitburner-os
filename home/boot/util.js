/** @param {NS} ns */
export const tprint = (ns) => (/** @type {string} */ message) => {
  const length = Math.max(0, 20 - ns.getScriptName().length);
  ns.tprint(" ".repeat(length) + message);
};
