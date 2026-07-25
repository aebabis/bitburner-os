export async function main(ns: NS) {
  ns.tprint(
    ns.stanek
      .activeFragments()
      .map(({ x, y, rotation, id }) => `[${x},${y},${rotation},${id}]`)
      .join(',\n'),
  );
}
