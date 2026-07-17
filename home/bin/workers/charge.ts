export async function main(ns: NS) {
  const fragmentCoords = ns.args.slice() as number[];
  if (fragmentCoords.length === 0) throw new Error('Must pass at least one set of fragment coords');
  if (fragmentCoords.length % 2 === 1)
    throw new Error('Input size must be even to form coordinate pairs');
  const coords = [] as { x: number; y: number }[];
  do {
    const x = fragmentCoords.shift()!;
    const y = fragmentCoords.shift()!;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error('Fragment coord list contained a non-integer: ' + ns.args);
    }
    coords.push({ x, y });
  } while (fragmentCoords.length > 0);
  try {
    while (true) {
      for (const { x, y } of coords) {
        await ns.stanek.chargeFragment(x, y);
      }
    }
  } catch (error) {
    console.log('Fragment probably rearranged');
    console.log(error);
  }
}
