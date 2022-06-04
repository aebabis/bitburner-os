// export const uuid = () => (+Math.random().toString().slice(2)).toString(16);
const COLOR_REGEX = /\u001b\[[0-9;]+m/g;

export const by = (prop) => {
	let val = prop;
	if (typeof val !== 'function') {
		val = (obj) => {
			const ret = obj[prop];
			if (typeof ret === 'undefined') {
				throw new Error(`invalid prop ${prop}`);
			}
			return ret;
		};
	}
	return (a, b) => {
		const va = val(a);
		const vb = val(b);
		if (va < vb)
			return -1;
		else if (va > vb)
			return 1;
		else
			return 0;
	};
};

export const length = (str) => str.replaceAll(COLOR_REGEX, '').length;

export const small = number => number.toString().toLowerCase().split('').map(n=>'₀₁₂₃₄₅₆₇₈₉'[n]||'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ'[n.charCodeAt(0)-97]||' ').join('');
export const bold = string => string.toString().split('')
	.map(n=>'𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'[n]||'𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳'[n.charCodeAt(0)-97]||'𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙'[n.charCodeAt(0)-65]||' ').join('');


/*

🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉
ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉
🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩
*/