export const hasBladeburnerReadyMults = (player: Player) =>
  player.mults.hacking > 2 &&
  player.mults.hacking_exp > 2 &&
  player.mults.agility > 2 &&
  player.mults.agility_exp > 2;
