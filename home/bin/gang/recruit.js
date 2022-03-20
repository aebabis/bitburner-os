/** @param {NS} ns **/
export async function main(ns) {
    while(ns.gang.canRecruitMember())
        ns.gang.recruitMember(crypto.randomUUID());
}