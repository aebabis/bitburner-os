type Color = string & ((str: string | number) => string);
const builder = (code: string): Color => {
  const func = (str: string | number): string => {
    const result = code + str + RESET;
    return {
      length: str.toString().length,
      valueOf: () => result,
      toString: () => result,
      toJSON: () => result,
    };
  };
  func.toString = func.valueOf = func.toJSON = () => code;
  return func;
};

type TermColor = Color & { BOLD: Color };
export const COLOR = (n: number): TermColor => {
  const func = builder(`\u001b[38;5;${n}m`) as TermColor;
  func.BOLD = builder(`\u001b[1;38;5;${n}m`);
  return func;
};
export const C = COLOR;
export const BG = (n: number) => builder(`\u001b[48;5;${n}m`);

export const KEYWORD = C(69);
export const GRAY = C(236);
export const STR = C(165);
export const BRIGHT = C(104);
export const NORMAL = C(98);
export const MEDIUM = C(60);
export const DARK = C(53);
export const DIM = C(236);
export const BORDER = C(17);
export const MONEY = C(217);
export const RESET = '\u001b[0m';

export const LOG = NORMAL;
export const ERROR = C(124); // 160
export const WARN = C(215);
export const INFO = C(63);
