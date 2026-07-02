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

// Standard normal quantile function (inverse CDF), via Winitzki's closed-form
// approximation of erfinv. Accurate to within ~1.3e-4, which is plenty for an estimate.
const normalQuantile = (p: number): number => {
  const a = 0.147;
  const x = 2 * p - 1;
  const ln1mx2 = Math.log(1 - x * x);
  const t = 2 / (Math.PI * a) + ln1mx2 / 2;
  const inner = Math.sqrt(t * t - ln1mx2 / a) - t;
  return Math.sign(x) * Math.sqrt(2 * inner);
};

// Largest k such that P(X >= k) >= confidence, where X ~ Binomial(n, p).
// Estimated via the normal approximation to the binomial (de Moivre-Laplace,
// valid by the CLT) with a continuity correction, so this is O(1) instead of
// O(n) - the exact CDF sum is too slow once n gets into the thousands+.
export const binomLowerBound = (n: number, p: number, confidence: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  const threshold = 1 - confidence;
  if (threshold <= 0) return 0;
  if (threshold >= 1) return n;

  const mean = n * p;
  const stdDev = Math.sqrt(mean * (1 - p));
  const z = normalQuantile(threshold);
  const k = Math.floor(mean + z * stdDev + 0.5);
  return Math.max(0, Math.min(n, k));
};
