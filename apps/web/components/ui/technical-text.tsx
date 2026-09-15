import React, { type CSSProperties, type ReactNode } from 'react';

interface TechnicalTextProps {
  children: ReactNode;
  as?: 'span' | 'code' | 'div' | 'p';
  className?: string;
  style?: CSSProperties;
}

/**
 * Ensures technical identifiers (Passports, Case IDs, URLs, Hashes, Emails)
 * always render left-to-right with monospace typography, even in RTL Arabic layout.
 */
export function TechnicalText({
  children,
  as: Component = 'span',
  className = '',
  style = {},
}: TechnicalTextProps) {
  return (
    <Component
      dir="ltr"
      className={className}
      style={{
        direction: 'ltr',
        unicodeBidi: 'isolate',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
