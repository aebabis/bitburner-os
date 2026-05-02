import { trade } from "./trade";
import { forecaster } from "./forecaster-trend";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  await trade(ns, forecaster(ns));
}
