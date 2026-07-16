import { setupRunner } from '../test-runner';

export async function main(ns: NS) {
  const { describe, it, start } = setupRunner();
  describe('My first test', () => {
    it('should run', () => {});
    it('can fail', () => {
      throw new Error(':(');
    });
  });

  start(ns);
}
