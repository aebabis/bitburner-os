import { trade } from './trade';
import { forecaster } from './forecaster-4s';

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');
  await trade(ns, forecaster(ns));
}
