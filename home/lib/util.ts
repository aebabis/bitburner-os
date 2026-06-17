const COLOR_REGEX = /\u001b\[[0-9;]+m/g;

export const formatTime = (seconds: number | null, emptyZero = false) => {
  if (seconds == null) {
    return '?';
  }
  if (emptyZero && seconds === 0) {
    return '';
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h === 0 && m === 0) {
    return ':' + pad(s);
  } else if (h === 0) {
    return `${pad(m)}:${pad(s)}`;
  } else {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
};

export const by = <T>(prop: ((elem: T) => string | number) | keyof T) => {
  if (typeof prop === 'function') {
    return (a: T, b: T) => {
      const va = prop(a);
      const vb = prop(b);
      if (va < vb) return -1;
      else if (va > vb) return 1;
      else return 0;
    };
  }
  return (a: T, b: T) => {
    const va = a[prop];
    const vb = b[prop];
    if (va < vb) return -1;
    else if (va > vb) return 1;
    else return 0;
  };
};

const RESERVED_PORTS = 1024;
export const randPort = () =>
  RESERVED_PORTS + 1 + Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - RESERVED_PORTS));

export const length = (str: string) => str.toString().replaceAll(COLOR_REGEX, '').length;

export const small = (number: string | number) =>
  number
    .toString()
    .toLowerCase()
    .split('')
    .map(
      (n: string) => '₀₁₂₃₄₅₆₇₈₉'[+n] || 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ'[n.charCodeAt(0) - 97] || ' ',
    )
    .join('');
