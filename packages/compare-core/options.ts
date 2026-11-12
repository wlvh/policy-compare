// One production algorithm. These limits control work, not document templates.
export const coreOptions = {
  version: 'english-generic/1',
  budget: { candidates: 20_000, tokenProducts: 100_000_000, diffProducts: 4_000_000 },
};
export type CoreOptions = typeof coreOptions;
export type Budget = CoreOptions['budget'];
