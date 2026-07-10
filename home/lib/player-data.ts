export const makePlayerData = (ns: NS) => ({
  homeRam: ns.getServerMaxRam('home'),
  wseAccount: ns.stock.hasWseAccount(),
  accessTixApi: ns.stock.hasTixApiAccess(),
  access4SData: ns.stock.has4SData(),
  access4SDataApi: ns.stock.has4SDataTixApi(),
});
