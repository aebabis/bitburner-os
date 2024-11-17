import { table } from '/lib/table';
import { GRAY } from '/lib/colors';
import { getPlayerData  } from '/lib/data-store';

const dec = (num, places=2) => {
    if (num === 0)
        return GRAY('-');
    const rounded = +num.toFixed(places);
    if (rounded < 1)
        return GRAY(0) + rounded.toString().substring(1);
    else
        return rounded;
}

const getCrimeTable = (ns) => {
    const { crimeStats } = getPlayerData(ns);
    const HEAD = ['NAME', 'DIFF', 'KARMA', 'TIME', {name:'$', align:'right'}, '%', '$-%/s',
        'Hack', 'Str', 'Def', 'Dex', 'Agi', 'Cha', 'Int'];
    return table(ns, HEAD, crimeStats.map(({
        type, difficulty, karma, time, money, chance, expectedValue,
        hacking_exp, strength_exp, defense_exp, dexterity_exp, agility_exp, charisma_exp, intelligence_exp,
    }) => [
        type, dec(difficulty), dec(karma), time/1000, ns.formatNumber(money), ~~(chance*100), expectedValue.toFixed(2),
        dec(hacking_exp), dec(strength_exp), dec(defense_exp), dec(dexterity_exp),
        dec(agility_exp), dec(charisma_exp), dec(intelligence_exp)
    ]), {colors: true});
  }

/** @param {NS} ns **/
export async function main(ns) {
    const [topic] = ns.args;
    if (topic === 'crimes')
        ns.tprint('\n'+getCrimeTable(ns));
}
