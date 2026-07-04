export const DarknetData = (() => {
  type DarknetFiles = Record<string, Record<string, string>>;
  type DarknetMap = Record<string, string[]>;

  let port = 12289108104000;
  const DARKNET_FILES = port++;
  const DARKNET_PASSWORDS = port++;
  const DARKNET_CACHE_HISTORY = port++;
  const DARKNET_CONNECTIONS = port++;

  const updatePassword = (ns: NS, hostname: string, password: string | null) => {
    const port = ns.getPortHandle(DARKNET_PASSWORDS);
    const passwords = (port.empty() ? {} : port.peek()) as Record<string, string>;
    if (password == null) delete passwords[hostname];
    else passwords[hostname] = password;
    port.empty();
    port.write(passwords);
  };

  return {
    PORTS: {
      DARKNET_FILES,
      DARKNET_PASSWORDS,
      DARKNET_CACHE_HISTORY,
      DARKNET_CONNECTIONS,
    },

    getPassword: (ns: NS) => (hostname: string) =>
      (ns.peek(DARKNET_PASSWORDS)[hostname] as string) ?? null,

    savePassword: (ns: NS) => (hostname: string, password: string) =>
      updatePassword(ns, hostname, password),

    deletePassword: (ns: NS) => (hostname: string) => updatePassword(ns, hostname, null),

    storeFiles: (ns: NS, hostname: string, files: Record<string, string>) => {
      const handle = ns.getPortHandle(DARKNET_FILES);
      if (handle.empty()) {
        handle.write({});
      }
      const data = handle.read() as DarknetFiles;
      data[hostname] = files;
      ns.clearPort(DARKNET_FILES);
      ns.writePort(DARKNET_FILES, data);
    },

    updateNetwork: (ns: NS, hostname: string, connections: string[]) => {
      const port = ns.getPortHandle(DARKNET_CONNECTIONS);
      const connectionMap = (port.empty() ? {} : port.peek()) as DarknetMap;
      connectionMap[hostname] = connections;
      port.clear();
      port.write(connectionMap);
    },

    getNetwork: (ns: NS) => {
      const port = ns.getPortHandle(DARKNET_CONNECTIONS);
      if (port.empty()) return null;
      else return port.peek() as DarknetMap;
    },
  };
})();
