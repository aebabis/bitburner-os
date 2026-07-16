type RunnerOptions = {
  baseColor?: string;
  passColor?: string;
  failColor?: string;
  skipColor?: string;
};
type Test = () => void | Promise<void>;
type TestEntry = { test: Test; skip: boolean };
type TestModule = {
  tests: Record<string, TestEntry>;
  submodules: Record<string, TestModule>;
};

const BASE = '\u001b[38;5;15m';
const PASS = '\u001b[38;5;28m';
const FAIL = '\u001b[38;5;1m';
const SKIP = '\u001b[38;5;244m';

const createModule = (): TestModule => ({ tests: {}, submodules: {} });

export const setupRunner = (
  ns: NS,
  { baseColor = BASE, passColor = PASS, failColor = FAIL, skipColor = SKIP } = {} as RunnerOptions,
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

  const registerTest = (description: string, test: Test, skip: boolean) => {
    if (currentModule.tests[description] != null) {
      throw new Error('Test with duplicate description: ' + description);
    }
    currentModule.tests[description] = { test, skip };
  };

  const it = Object.assign(
    (description: string, test: Test) => registerTest(description, test, false),
    { skip: (description: string, test: Test) => registerTest(description, test, true) },
  );

  const test = it;

  const runModule = async (module: TestModule, indent = '') => {
    for (const [testName, { test, skip }] of Object.entries(module.tests)) {
      if (skip) {
        ns.tprint(skipColor + indent + '○ ' + testName);
        continue;
      }
      try {
        await test();
        ns.tprint(passColor + indent + '✓ ' + testName);
      } catch (error) {
        ns.tprint(
          `${failColor}${indent}✖ ${testName}\n${' '.repeat(newLineIndent)}${indent}  ${error}`,
        );
      }
    }
    for (const [moduleName, submodule] of Object.entries(module.submodules)) {
      ns.tprint(baseColor + indent + '➤ ' + moduleName);
      await runModule(submodule, indent + '  ');
    }
  };

  const runSuite = async () => {
    await runModule(currentModule);
  };

  return { describe, it, test, runSuite, expect, assert };
};

export const expect = () => {
  throw new Error('Not supported yet');
};

const isDeepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      key in b &&
      isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
};

const assertBase = (condition: boolean, message?: string) => {
  if (!condition) throw new Error(message ?? 'Assertion failed');
};

export const assert = Object.assign(assertBase, {
  ok: (condition: unknown, message?: string) => assertBase(Boolean(condition), message),
  equal: (actual: unknown, expected: unknown, message?: string) =>
    assertBase(Object.is(actual, expected), message ?? `Expected ${expected}, got ${actual}`),
  notEqual: (actual: unknown, expected: unknown, message?: string) =>
    assertBase(
      !Object.is(actual, expected),
      message ?? `Expected values to differ, both were ${actual}`,
    ),
  deepEqual: (actual: unknown, expected: unknown, message?: string) =>
    assertBase(
      isDeepEqual(actual, expected),
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    ),
  // Relative tolerance (with an absolute floor of 1) so comparisons stay meaningful across
  // both tiny and huge magnitudes without callers having to scale the tolerance themselves.
  close: (actual: number, expected: number, tolerance = 1e-6, message?: string) =>
    assertBase(
      Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
      message ?? `Expected ${actual} to be within ${tolerance * 100}% of ${expected}`,
    ),
});
