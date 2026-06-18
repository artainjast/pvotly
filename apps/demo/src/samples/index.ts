import type { SampleMeta, SampleModule } from './types';

/**
 * Auto-discover every sample module in this folder. Each file must export a
 * `meta: SampleMeta` and a default React component. Dropping a new file in here
 * registers it automatically — no manual wiring.
 */
const modules = import.meta.glob('./*.tsx', { eager: true }) as Record<
  string,
  { meta?: SampleMeta; default?: SampleModule['Component'] }
>;

const GROUP_ORDER: SampleMeta['group'][] = [
  'Getting started',
  'Features',
  'Data sources',
  'Frameworks',
  'Reference',
];

export const SAMPLES: SampleModule[] = Object.values(modules)
  .filter((m): m is { meta: SampleMeta; default: SampleModule['Component'] } => !!m.meta && !!m.default)
  .map((m) => ({ meta: m.meta, Component: m.default }))
  .sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.meta.group) - GROUP_ORDER.indexOf(b.meta.group);
    return g !== 0 ? g : a.meta.title.localeCompare(b.meta.title);
  });

export const SAMPLES_BY_GROUP: Array<{ group: string; items: SampleModule[] }> = GROUP_ORDER.map(
  (group) => ({ group, items: SAMPLES.filter((s) => s.meta.group === group) }),
).filter((g) => g.items.length > 0);

export function findSample(id: string): SampleModule | undefined {
  return SAMPLES.find((s) => s.meta.id === id);
}

export type { SampleMeta, SampleModule } from './types';
