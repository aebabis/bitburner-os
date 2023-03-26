const builder = (code) => {
	const func = (str) => {
		const result = code + str + RESET;
		return {
			length: str,
			valueOf: () => result,
			toString: () => result,
			toJSON: () => result,
		};
	};
	func.toString = func.valueOf = func.toJSON = () => code;
	return func;
}
export const COLOR = (n) => {
	const func = builder(`\u001b[38;5;${n}m`);
	func.BOLD = builder(`\u001b[1;38;5;${n}m`);
	return func;
}
export const C = COLOR;
export const BG = (n) => builder(`\u001b[48;5;${n}m`);

export const KEYWORD = C(69);
export const GRAY = C(236);
export const STR = C(165);
export const BRIGHT = C(104);
export const NORMAL = C(98);
export const MEDIUM = C(55);
export const DARK = C(17);
export const RESET = '\u001b[0m';

export const LOG = NORMAL;
export const ERROR = C(124); // 160
export const WARN = C(214);
export const INFO = C(63);

/** @param {NS} ns */
export async function main(ns) {
	// ns.tprint(ns.getScriptRam('/bin/access.js', 'home'));
	ns.tprint([61, 62, 63].map(i => `${C(i)}${i} `).join(''));
	ns.tprint([52, 53, 54, 55].map(i => `${C(i)}${i} `).join(''));
	ns.tprint([89, 90, 91, 92, 93, 97, 98, 99].map(i => `${C(i)}${i} `).join(''));
	ns.tprint([125, 126, 127, 128, 129, 133, 134, 135].map(i => `${C(i)}${i} `).join(''));
	ns.tprint([164, 165, 170, 171].map(i => `${C(i)}${i} `).join(''));
	ns.tprint(`${STR.BOLD}TITLE`);
	ns.tprint(`${STR}Subtitle`);
	ns.tprint(`${NORMAL.BOLD}SECTION`);
	ns.tprint(`${NORMAL}Attempting to ${KEYWORD}restart`);
    ns.tprint(`${ERROR}Something went wrong`);
    ns.tprint(`${GRAY}Don't look at me!`);
	ns.tprint([53, 54, 55, 56, 57, 56, 55, 54, 53].map(n=>`${BG(n)} `).join(''));
}