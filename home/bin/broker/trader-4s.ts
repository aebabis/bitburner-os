import { trade } from './trade';
import { forecaster } from './forecaster-4s';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  await trade(ns, forecaster(ns));
}
