export const hasBladeburnerReadyMults = (player: Player) =>
  player.mults.hacking > 1.5 &&
  player.mults.hacking_exp > 1.7 &&
  player.mults.agility > 1.7 &&
  player.mults.agility_exp > 2;
