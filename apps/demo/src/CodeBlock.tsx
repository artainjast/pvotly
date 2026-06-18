import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

interface Props {
  code: string;
  language?: string;
  theme?: 'light' | 'dark';
}

/** Syntax-highlighted, copyable code block. */
export default function CodeBlock({ code, language = 'tsx', theme = 'dark' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <div className="docs-codeblock">
      <button className="docs-copy" onClick={copy} type="button" aria-label="Copy code">
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <Highlight code={code.trimEnd()} language={language} theme={theme === 'dark' ? themes.vsDark : themes.vsLight}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`docs-code ${className}`} style={style} data-testid="code">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="docs-code-ln">{i + 1}</span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
