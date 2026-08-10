const SIDEBAR_WIDTH = 249;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 200;

const shortName = (ns: NS) => ns.getScriptName().split('/').pop()!.split('.').shift();

interface TailProps {
  name?: string;
  width?: number;
  height?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

const normalizeProps = (ns: NS, tailProps: TailProps) => {
  const winHeight = globalThis.innerHeight;
  const winWidth = globalThis.innerWidth - SIDEBAR_WIDTH;
  const name = tailProps.name ?? shortName(ns);
  const width =
    tailProps.left != null && tailProps.right != null
      ? winWidth - tailProps.left - tailProps.right
      : (tailProps.width ?? DEFAULT_WIDTH);
  const height =
    tailProps.top != null && tailProps.bottom != null
      ? winHeight - tailProps.top - tailProps.bottom
      : (tailProps.height ?? DEFAULT_HEIGHT);
  const top =
    tailProps.top ?? (tailProps.bottom != null ? winHeight - height - tailProps.bottom : 0);
  const left =
    SIDEBAR_WIDTH +
    (tailProps.left ?? (tailProps.right != null ? winWidth - width - tailProps.right : 0));
  return { name, width, height, top, left };
};

export const setupTail = (ns: NS, tailProps: TailProps = {}) => {
  const { name, width, height, top, left } = normalizeProps(ns, tailProps);
  ns.disableLog('ALL');

  ns.ui.openTail();
  ns.ui.setTailTitle(`\u200b ${name}`);
  ns.ui.resizeTail(width, height);
  ns.ui.moveTail(left, top);
};
