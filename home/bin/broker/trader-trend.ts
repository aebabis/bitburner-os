import { trade } from './trade';
import { forecaster } from './forecaster-trend';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  await trade(ns, forecaster());
}
