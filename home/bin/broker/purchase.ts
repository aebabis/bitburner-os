type StockApiName =
  | 'purchaseWseAccount'
  | 'purchaseTixApi'
  | 'purchase4SMarketDataTixApi'
  | 'purchase4SMarketData';
const mayPurchase = (ns: NS, funcName: StockApiName) => {
  if (funcName === 'purchaseWseAccount') {
    return true;
  } else if (funcName.includes('urchaseTixApi')) {
    return ns.stock.hasWseAccount();
  } else {
    return ns.stock.hasTixApiAccess();
  }
};

export async function main(ns: NS) {
  ns.stock.purchaseWseAccount; // Reserve RAM

  const [funcName] = ns.args;
  if (mayPurchase(ns, funcName as StockApiName)) {
    ns.stock[funcName as StockApiName]();
  }
}
