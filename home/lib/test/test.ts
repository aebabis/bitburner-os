import { setupRunner } from '../test-runner';

export async function main(ns: NS) {
  const { describe, it, runSuite } = setupRunner(ns);
  describe('My first test', () => {
    it('should run', () => {});
    it('can fail', () => {
      throw new Error(':(');
    });
  });

  describe('Async stuff', () => {
    it('should pass under timeout', async () => {
      await ns.sleep(1000);
    });
  });

  await runSuite();
}
