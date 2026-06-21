export const terminalTracker = (ns: NS) => {
  let lastTerminalActivity = Date.now();

  const update = (event: KeyboardEvent) => {
    const input = event.target as HTMLElement;
    if (input.id === 'terminal-input') lastTerminalActivity = Date.now();
  };

  globalThis['document'].body.addEventListener('keypress', update, true);
  ns.atExit(() => {
    globalThis['document'].body.removeEventListener('keypress', update, true);
  });

  return () => lastTerminalActivity;
};
