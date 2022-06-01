const FILES = [
  '/bin/access.js',
  '/bin/accountant.js',
  '/bin/broker/api.js',
  '/bin/broker/broker.js',
  '/bin/broker/dump.js',
  '/bin/broker/forecaster-4s.js',
  '/bin/broker/forecaster-trend.js',
  '/bin/broker/load-stocks.js',
  '/bin/broker/purchase.js',
  '/bin/broker/trade.js',
  '/bin/broker/trader-4s.js',
  '/bin/broker/trader-trend.js',
  '/bin/contracts/algorithms.js',
  '/bin/contracts/complete.js',
  '/bin/contracts/freelancer.js',
  '/bin/contracts/headhunter.js',
  '/bin/contracts/mapper.js',
  '/bin/dashboard.js',
  '/bin/gang/assign-members.js',
  '/bin/gang/decide-war.js',
  '/bin/gang/gang-data.js',
  '/bin/gang/mob-boss.js',
  '/bin/gang/recruit.js',
  '/bin/gang/task-table.js',
  '/bin/hacknet.js',
  '/bin/infect.js',
  '/bin/liquidate.js',
  '/bin/logger.js',
  '/bin/planner.js',
  '/bin/purchase-threadpool.js',
  '/bin/scheduler.js',
  '/bin/self/actualize.js',
  '/bin/self/apply.js',
  '/bin/self/aug/analyze.js',
  '/bin/self/aug/augment.js',
  '/bin/self/aug/factions.js',
  '/bin/self/aug/install.js',
  '/bin/self/aug/join-factions.js',
  '/bin/self/aug/load-aug-names.js',
  '/bin/self/aug/load-aug-prereqs.js',
  '/bin/self/aug/load-aug-prices.js',
  '/bin/self/aug/load-aug-reps.js',
  '/bin/self/aug/load-aug-stats.js',
  '/bin/self/aug/load-faction-favor.js',
  '/bin/self/aug/load-owned-augs.js',
  '/bin/self/aug/purchase-augs.js',
  '/bin/self/backdoor.js',
  '/bin/self/buy-ram.js',
  '/bin/self/control.js',
  '/bin/self/crime-chance.js',
  '/bin/self/crime-stats.js',
  '/bin/self/crime.js',
  '/bin/self/faction-work.js',
  '/bin/self/hack.js',
  '/bin/self/improvement.js',
  '/bin/self/job.js',
  '/bin/self/rep-recorder.js',
  '/bin/self/respect.js',
  '/bin/self/tor.js',
  '/bin/self/travel.js',
  '/bin/self/work.js',
  '/bin/server-purchaser.js',
  '/bin/share.js',
  '/bin/stalker.js',
  '/bin/thief.js',
  '/bin/workers/grow.js',
  '/bin/workers/hack.js',
  '/bin/workers/share.js',
  '/bin/workers/weaken.js',
  'books.js',
  '/boot/boot.js',
  '/boot/cheaty-data.js',
  '/boot/data.js',
  '/boot/data2-lite.js',
  '/boot/data2.js',
  '/boot/data3.js',
  '/boot/defer.js',
  '/boot/network.js',
  '/boot/reset.js',
  '/boot/spawn.js',
  '/boot/ui.js',
  '/boot/util.js',
  'config.js',
  'contracts.js',
  '/etc/config.js',
  '/etc/filenames.js',
  '/etc/ports.js',
  'gang.js',
  '/lib/augmentations.js',
  '/lib/backdoor.js',
  '/lib/config.js',
  '/lib/d3.js',
  '/lib/data-store.js',
  '/lib/formulas.js',
  '/lib/hacknet.js',
  '/lib/layout.js',
  '/lib/logger.js',
  '/lib/modal.js',
  '/lib/nmap.js',
  '/lib/ports.js',
  '/lib/query-service.js',
  '/lib/rmi.js',
  '/lib/scheduler-api.js',
  '/lib/scheduler-delegate.js',
  '/lib/service-api.js',
  '/lib/service.js',
  '/lib/table.js',
  '/lib/thief.js',
  '/lib/timeline.js',
  '/lib/util.js',
  'manual.js',
  'nmap-gui.js',
  'ram.js',
  'read.js',
  'restart.js',
  'servers.js',
  'services.js',
  'start.js',
  'stop.js',
  'suite.js',
  'tail.js',
  'update.js',
];

/** @param {NS} ns **/
export async function main(ns) {
  const { branch } = ns.flags([['branch', 'main']]);
  if (_[0] != null) {
    ns.tprint('\u001b[31mUnrecognized parameter(s): ' + _ + '. To set a branch use --branch BRANCH');
    return;
  }
  for (const file of FILES) {
    const downloadPath = `https://raw.githubusercontent.com/aebabis/bitburner-os/${branch}/home/${file}`;
    await ns.wget(downloadPath, file);
    ns.tprint(`Downloaded ${file}`);
  }
  ns.tprint('Download complete');
}