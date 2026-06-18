import { useEffect, useState } from 'react';
import { SAMPLES, SAMPLES_BY_GROUP, findSample } from './samples';
import Landing from './Landing';
import CodeBlock from './CodeBlock';
import SandboxPanel from './SandboxPanel';
import { GITHUB_URL, hasSandbox, openSandbox } from './sandbox';

type Theme = 'light' | 'dark';
type Tab = 'live' | 'code' | 'sandbox';

function currentId(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

function initialTheme(): Theme {
  const saved = window.localStorage.getItem('pvotly-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [id, setId] = useState(currentId);
  const [tab, setTab] = useState<Tab>('live');
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const onHash = () => {
      setId(currentId());
      setTab('live');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('pvotly-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Empty hash → marketing landing. A sample id → docs/playground.
  const isLanding = id === '';

  return (
    <div className="pvroot" data-theme={theme}>
      {isLanding ? (
        <Landing theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <Docs id={id} tab={tab} setTab={setTab} theme={theme} onToggleTheme={toggleTheme} />
      )}
    </div>
  );
}

interface DocsProps {
  id: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function Docs({ id, tab, setTab, theme, onToggleTheme }: DocsProps) {
  const sample = findSample(id) ?? SAMPLES[0];

  return (
    <div className="docs">
      <aside className="docs-sidebar">
        <a className="docs-brand" href="#/">
          <span className="docs-logo" aria-hidden /> Pvotly
        </a>
        <p className="docs-tagline">Customizable, framework-agnostic pivot tables.</p>
        <div className="docs-sidebar-actions">
          <a className="docs-home" href="#/">
            ← Home
          </a>
          <a
            className="docs-github"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub repository"
          >
            GitHub
          </a>
          <button className="docs-theme" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <nav>
          {SAMPLES_BY_GROUP.map(({ group, items }) => (
            <div className="docs-group" key={group}>
              <div className="docs-group-title">{group}</div>
              {items.map((s) => (
                <a
                  key={s.meta.id}
                  href={`#/${s.meta.id}`}
                  data-testid={`nav-${s.meta.id}`}
                  className={`docs-link${s.meta.id === sample?.meta.id ? ' active' : ''}`}
                >
                  {s.meta.title}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="docs-main" data-testid={`sample-${sample?.meta.id}`}>
        {sample && (
          <>
            <header className="docs-header">
              <h1>{sample.meta.title}</h1>
              <p>{sample.meta.description}</p>
              <div className="docs-tabs">
                <button
                  className={tab === 'live' ? 'active' : ''}
                  onClick={() => setTab('live')}
                  data-testid="tab-live"
                >
                  Live demo
                </button>
                <button
                  className={tab === 'code' ? 'active' : ''}
                  onClick={() => setTab('code')}
                  data-testid="tab-code"
                >
                  Code
                </button>
                {hasSandbox(sample) && (
                  <button
                    className={tab === 'sandbox' ? 'active' : ''}
                    onClick={() => setTab('sandbox')}
                    data-testid="tab-sandbox"
                  >
                    Sandbox
                  </button>
                )}
              </div>
            </header>

            {tab === 'live' && (
              <section className="docs-live" data-testid="live">
                <sample.Component />
              </section>
            )}

            {tab === 'code' && (
              <section className="docs-code-section">
                {hasSandbox(sample) && (
                  <div className="docs-code-actions">
                    <button
                      className="docs-stackblitz"
                      type="button"
                      onClick={() => openSandbox(sample)}
                    >
                      ⚡ Open in StackBlitz
                    </button>
                  </div>
                )}
                <CodeBlock code={sample.meta.code} theme={theme} />
              </section>
            )}

            {tab === 'sandbox' && <SandboxPanel sample={sample} theme={theme} />}
          </>
        )}
      </main>
    </div>
  );
}
