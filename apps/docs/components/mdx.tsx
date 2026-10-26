import React from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { MermaidDiagram } from './mermaid-diagram';
import { RoleBadge } from './role-badge';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';

// Recursively extract all text content from React nodes/tokens
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node) && (node.props as any)) {
    return extractText((node.props as any).children);
  }
  return '';
}

// Check if a code fence represents a Mermaid diagram
function isMermaid(props: any, text: string): boolean {
  if (props['data-language'] === 'mermaid' || props['data-lang'] === 'mermaid') return true;
  if (typeof props.className === 'string' && props.className.includes('mermaid')) return true;

  const children = React.Children.toArray(props.children);
  for (const child of children) {
    if (React.isValidElement(child) && child.props) {
      const p = child.props as any;
      if (p['data-language'] === 'mermaid' || p['data-lang'] === 'mermaid') return true;
      if (typeof p.className === 'string' && p.className.includes('mermaid')) return true;
    }
  }

  const trimmed = text.trim();
  const diagramKeywords = [
    'flowchart',
    'graph',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'journey',
    'mindmap',
    'timeline',
    'quadrantChart',
    'sankey-beta',
  ];
  return diagramKeywords.some((kw) => trimmed.startsWith(kw));
}

// Custom pre renderer that intercepts ```mermaid code fences
function PreBlock(props: React.ComponentProps<'pre'>) {
  const chartText = extractText(props.children).trim();

  if (isMermaid(props, chartText)) {
    return <MermaidDiagram chart={chartText} />;
  }

  // Fall back to Fumadocs default pre
  const DefaultPre = defaultMdxComponents.pre as React.ComponentType<any>;
  if (DefaultPre) {
    return <DefaultPre {...props} />;
  }
  return <pre {...props} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    pre: PreBlock,
    Mermaid: MermaidDiagram,
    MermaidDiagram,
    RoleBadge,
    Tab,
    Tabs,
    Callout,
    Card,
    Cards,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
