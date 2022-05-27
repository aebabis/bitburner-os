import { trade } from './bin/broker/trader';
import { forecaster } from './bin/broker/forecaster-4s';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    await trade(ns, forecaster(ns));
}