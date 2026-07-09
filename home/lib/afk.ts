export const makeAfkTracker = (ns: NS) => {
  let lastActivity = Date.now();
  const track = () => (lastActivity = Date.now());
  globalThis.addEventListener('mousemove', track, true);
  globalThis.addEventListener('keypress', track, true);
  globalThis.addEventListener('click', track, true);
  ns.atExit(() => {
    globalThis.removeEventListener('mousemove', track, true);
    globalThis.removeEventListener('keypress', track, true);
    globalThis.removeEventListener('click', track, true);
  });
  return {
    lastActivity: () => lastActivity,
    timeSinceAction: () => Date.now() - lastActivity,
  };
};
