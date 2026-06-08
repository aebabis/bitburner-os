import { putBladeReports } from '../../../lib/data-store';
import { table } from '../../../lib/table';
import { formatTime } from '../../../lib/util';

export async function main(ns: NS) {
  const [type, name] = ns.args as [
    BladeburnerActionType,
    BladeburnerActionName,
  ];
  const current = ns.bladeburner.getCurrentAction();
  if (current == null || current.type !== type || current.name !== name) {
    ns.bladeburner.startAction(type, name);
  }

  const tFormat = (ms: number) => formatTime(ms).replace(/^0/, '');
  if (current) {
    const currentTime = ns.bladeburner.getActionCurrentTime();
    const actionTime = ns.bladeburner.getActionTime(
      current.type as BladeburnerActionType,
      current.name as BladeburnerActionName,
    );
    const columns = ['ACTION', ''];
    const rows = [
      [
        current.name,
        `${tFormat(currentTime / 1000)}/${tFormat(actionTime / 1000)}`,
      ],
    ];
    putBladeReports(ns, { Action: table(ns, columns, rows, { colors: true }) });
  }
}
