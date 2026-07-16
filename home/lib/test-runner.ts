type Test = () => void;
type TestModule = {
  tests: Record<string, Test>;
  submodules: Record<string, TestModule>;
};

const PASS = '\u001b[38;5;28m';
const FAIL = '\u001b[38;5;1m';
const BASE = '\u001b[38;5;15m';

const createModule = (): TestModule => ({ tests: {}, submodules: {} });

export const setupRunner = () => {
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

  const runModule = (ns: NS, module: TestModule, indent = '') => {
    for (const [testName, test] of Object.entries(module.tests)) {
      try {
        test();
        ns.tprint(PASS + indent + '✓ ' + testName);
      } catch (error) {
        ns.tprint(FAIL + indent + '✖ ' + error);
      }
    }
    for (const [moduleName, submodule] of Object.entries(module.submodules)) {
      ns.tprint(BASE + indent + '➤ ' + moduleName);
      runModule(ns, submodule, indent + '  ');
    }
  };

  const start = (ns: NS) => {
    runModule(ns, currentModule);
  };

  return { describe, it, test, start, expect, assert };
};

export const expect = () => {
  throw new Error('Not supported yet');
};

export const assert = (condition: boolean, message?: string) => {
  if (!condition) throw new Error(message ?? 'Assertion failed');
};
