// export const uuid = () => (+Math.random().toString().slice(2)).toString(16);
const COLOR_REGEX = /\u001b\[[0-9;]+m/g;

/** @template T @param {((item: T) => (number | string)) | string | number} prop @returns {(a: T, b: T) => number} */
export const by = (prop) => {
  let val = prop;
  if (typeof val !== "function") {
    val = /** @type {(item: T) => (number | string)} */ ((/** @type {T} */ obj) => {
      const ret = (/** @type {Record<string, number | string>} */ (/** @type {unknown} */ (obj)))[/** @type {string} */ (prop)];
      if (typeof ret === "undefined") {
        throw new Error(`invalid prop ${prop}`);
      }
      return ret;
    });
  }
  return (a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -1;
    else if (va > vb) return 1;
    else return 0;
  };
};

/** @param {string} str */
export const length = (str) => str.replaceAll(COLOR_REGEX, "").length;

/** @param {string | number} number */
export const small = (number) =>
  number
    .toString()
    .toLowerCase()
    .split("")
    .map(
      /** @param {string} n */ (n) =>
        "₀₁₂₃₄₅₆₇₈₉"[/** @type {number} */ (/** @type {unknown} */ (n))] ||
        "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ"[n.charCodeAt(0) - 97] ||
        " ",
    )
    .join("");
