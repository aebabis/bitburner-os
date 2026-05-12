/** @param {string} code
 *  @returns {string & ((str: string|number) => string)} */
const builder = (code) => {
  /** @param {string|number} str
   *  @returns {string} */
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
};
/** @param {number} n
 *  @returns {ReturnType<typeof builder> & { BOLD: ReturnType<typeof builder> }} */
export const COLOR = (n) => {
  const func = builder(`\u001b[38;5;${n}m`);
  func.BOLD = builder(`\u001b[1;38;5;${n}m`);
  return func;
};
export const C = COLOR;
/** @param {number} n */
export const BG = (n) => builder(`\u001b[48;5;${n}m`);

export const KEYWORD = C(69);
export const GRAY = C(236);
export const STR = C(165);
export const BRIGHT = C(104);
export const NORMAL = C(98);
export const MEDIUM = C(55);
export const DARK = C(17);
export const RESET = "\u001b[0m";

export const LOG = NORMAL;
export const ERROR = C(124); // 160
export const WARN = C(214);
export const INFO = C(63);
