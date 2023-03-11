/** @param {NS} ns **/
export async function main(ns) {
    const [bn, script] = ns.args;
    ns.singularity.b1tflum3(+bn, script);
}