export {};

// Bitburner's in-game runtime transpiles JSX itself (no bundler involved), so
// this only needs to satisfy the TS compiler/editor. It reuses the ReactElement
// and ReactNode types Bitburner already declares globally for ns.printRaw/tprintRaw.
declare global {
  namespace JSX {
    type Element = ReactElement;
    interface IntrinsicElements {
      [tagName: string]: Record<string, any>;
    }
  }

  const React: {
    createElement(
      type: string | ((props: any) => ReactNode) | (new (props: any) => object),
      props: Record<string, any> | null,
      ...children: ReactNode[]
    ): ReactElement;
    Fragment(props: { children?: ReactNode }): ReactNode;
  };
}
