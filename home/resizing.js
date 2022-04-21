import { getTailModal } from './lib/modal';

/** @param {NS} ns **/
export async function main(ns) {
    const elem = await getTailModal(ns);
    const container = elem.querySelector('.MuiBox-root');
    const testString = '0'.repeat(48);
    ns.print(testString);
    let testP;
    while (testP == null) {
        testP = container.querySelector('p');
        await ns.sleep(10);
    }
    testP.style.display = 'inline';
    const { width } = testP.getBoundingClientRect();
    const charWidth = width / testString.length;
    console.log(charWidth);
    while (true) {
        const numChars = Math.floor(container.clientWidth / charWidth);
        ns.print('-'.repeat(numChars));
        await ns.sleep(1000);
    }
}