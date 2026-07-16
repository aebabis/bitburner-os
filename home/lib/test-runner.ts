type RunnerOptions = {
  baseColor?: string;
  passColor?: string;
  failColor?: string;
};
type Test = () => void;
type TestModule = {
  tests: Record<string, Test>;
  submodules: Record<string, TestModule>;
};

const BASE = '\u001b[38;5;15m';
const PASS = '\u001b[38;5;28m';
const FAIL = '\u001b[38;5;1m';

const createModule = (): TestModule => ({ tests: {}, submodules: {} });

export const setupRunner = (
  ns: NS,
  { baseColor = BASE, passColor = PASS, failColor = FAIL } = {} as RunnerOptions,
) => {
  const newLineIndent = ns.getScriptName().length + 2;
  let currentModule = createModule();

  const describe = (moduleName: string, builder: () => void) => {
    const parentModule = currentModule;
    let submodule = currentModule.submodules[moduleName];
    if (submodule == null) {
      submodule = currentModule.submodules[moduleName] = createModule();
    }
    currentModule = submodule;
    builder();
    currentModule = parentModule;
  };

  const it = (description: string, test: Test) => {
    if (currentModule.tests[description] != null) {
      throw new Error('Test with duplicate description: ' + description);
    }
    currentModule.tests[description] = test;
  };

  const test = it;

  const runModule = (module: TestModule, indent = '') => {
    for (const [testName, test] of Object.entries(module.tests)) {
      try {
        test();
        ns.tprint(passColor + indent + '✓ ' + testName);
      } catch (error) {
        ns.tprint(
          `${failColor}${indent}✖ ${testName}\n${' '.repeat(newLineIndent)}${indent}  ${error}`,
        );
      }
    }
    for (const [moduleName, submodule] of Object.entries(module.submodules)) {
      ns.tprint(baseColor + indent + '➤ ' + moduleName);
      runModule(submodule, indent + '  ');
    }
  };

  const start = () => {
    runModule(currentModule);
  };

  return { describe, it, test, start, expect, assert };
};

export const expect = () => {
  throw new Error('Not supported yet');
};

export const assert = (condition: boolean, message?: string) => {
  if (!condition) throw new Error(message ?? 'Assertion failed');
};
