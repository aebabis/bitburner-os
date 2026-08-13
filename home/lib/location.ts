import { getServices } from './service-api';

type CityLock = {
  city: CityName;
  timeLeft: number;
};

/**
 * Determine potential reason for player to stay in current city
 * and time remaining on their stay.
 */
export const getCityLock = (ns: NS, player: Player): CityLock | null => {
  if (getServices(ns)?.find((service) => service.name === 'casino')?.allowed) {
    // Calculate rough estimate of casino time:
    // - casino is for getting the player's first $10b
    // - it takes ~30 roulette spins to finish
    // - a roulette spin takes 1.6s
    const moneyLeft = Math.max(1, 10e9 - player.money);
    const spinsLeft = (30 * moneyLeft) / 10e9;
    const timeLeft = spinsLeft * 1600;
    return { city: 'Aevum', timeLeft };
  }

  return null;
};
