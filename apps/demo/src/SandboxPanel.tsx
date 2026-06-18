import { useEffect, useRef } from 'react';
import { embedSandbox } from './sandbox';
import type { SampleModule } from './samples';

interface Props {
  sample: SampleModule;
  theme: 'light' | 'dark';
}

/**
 * In-page StackBlitz embed. Mounts only when rendered (i.e. when the Sandbox
 * tab is opened), so the heavy iframe never loads for the Live/Code tabs.
 */
export default function SandboxPanel({ sample, theme }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    embedSandbox(el, sample, theme);
  }, [sample, theme]);

  return <div className="docs-sandbox" ref={ref} data-testid="sandbox" />;
}
