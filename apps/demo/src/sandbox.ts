import sdk, { type Project } from '@stackblitz/sdk';
import type { SampleMeta } from './samples/types';

/**
 * Build a fully runnable StackBlitz project from a sample's *actual* source
 * (imported raw via Vite `?raw`), not the illustrative `meta.code` snippet —
 * so "open in StackBlitz" / the in-page embed run the real example against the
 * published `@pvotly/*` packages from npm.
 */

export const GITHUB_URL = 'https://github.com/artainjast/pvotly';

// Raw source of every sample + the shared data/types modules. The project
// mirrors the repo layout (src/samples/<file>, src/data.ts) so the samples'
// relative imports (`../data`, `./types`) resolve unchanged.
const SAMPLE_SOURCES = import.meta.glob('./samples/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const SAMPLE_METAS = import.meta.glob('./samples/*.tsx', { eager: true }) as Record<
  string,
  { meta?: SampleMeta }
>;
import DATA_SOURCE from './data?raw';
import TYPES_SOURCE from './samples/types?raw';

/** Map sample id → { fileBase, source }. */
function entryFor(id: string): { fileBase: string; source: string } | null {
  for (const path of Object.keys(SAMPLE_METAS)) {
    if (SAMPLE_METAS[path]?.meta?.id !== id) continue;
    const file = path.split('/').pop()!; // e.g. "charts.tsx"
    return { fileBase: file.replace(/\.tsx$/, ''), source: SAMPLE_SOURCES[path] ?? '' };
  }
  return null;
}

const PKG_JSON = JSON.stringify(
  {
    name: 'pvotly-sample',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build' },
    dependencies: {
      '@pvotly/core': 'latest',
      '@pvotly/web': 'latest',
      '@pvotly/react': 'latest',
      '@pvotly/charts': 'latest',
      'chart.js': '^4',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4',
      '@types/react': '^18',
      '@types/react-dom': '^18',
      typescript: '^5',
      vite: '^6',
    },
  },
  null,
  2,
);

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
`;

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
    },
    include: ['src'],
  },
  null,
  2,
);

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pvotly sample</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

function mainTsx(fileBase: string): string {
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@pvotly/web/styles.css';
import Sample from './samples/${fileBase}';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <Sample />
    </div>
  </StrictMode>,
);
`;
}

function buildProject(sample: { meta: SampleMeta }): Project | null {
  const entry = entryFor(sample.meta.id);
  if (!entry) return null;
  return {
    title: `Pvotly — ${sample.meta.title}`,
    description: sample.meta.description,
    template: 'node',
    files: {
      'package.json': PKG_JSON,
      'vite.config.ts': VITE_CONFIG,
      'tsconfig.json': TSCONFIG,
      'index.html': INDEX_HTML,
      'src/main.tsx': mainTsx(entry.fileBase),
      'src/data.ts': DATA_SOURCE,
      'src/samples/types.ts': TYPES_SOURCE,
      [`src/samples/${entry.fileBase}.tsx`]: entry.source,
    },
  };
}

function openFileFor(sample: { meta: SampleMeta }): string {
  const entry = entryFor(sample.meta.id);
  return entry ? `src/samples/${entry.fileBase}.tsx` : 'src/main.tsx';
}

/** True when this sample's source is available to scaffold. */
export function hasSandbox(sample: { meta: SampleMeta }): boolean {
  return entryFor(sample.meta.id) != null;
}

/** Open the sample in a new StackBlitz tab. */
export function openSandbox(sample: { meta: SampleMeta }): void {
  const project = buildProject(sample);
  if (!project) return;
  sdk.openProject(project, { newWindow: true, openFile: openFileFor(sample) });
}

/** Embed the running sample as a StackBlitz iframe inside `el`. */
export function embedSandbox(
  el: HTMLElement,
  sample: { meta: SampleMeta },
  theme: 'light' | 'dark',
): void {
  const project = buildProject(sample);
  if (!project) return;
  void sdk.embedProject(el, project, {
    openFile: openFileFor(sample),
    view: 'preview',
    height: 560,
    theme,
    hideExplorer: false,
  });
}
