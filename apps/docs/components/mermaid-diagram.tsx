'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: isDark ? 'dark' : 'default',
          fontFamily: 'var(--font-body), system-ui, sans-serif',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: '#05070a',
                primaryColor: '#182030',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#3b82f6',
                lineColor: '#60a5fa',
                textColor: '#f8fafc',
                mainBkg: '#0a0f1d',
                nodeBorder: '#3b82f6',
                clusterBkg: '#070a12',
                clusterBorder: '#1e293b',
                edgeLabelBackground: '#05070a',
              }
            : {
                darkMode: false,
                background: '#ffffff',
                primaryColor: '#f1f5f9',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#0284c7',
                lineColor: '#64748b',
                textColor: '#0f172a',
                mainBkg: '#f8fafc',
                nodeBorder: '#0284c7',
                clusterBkg: '#ffffff',
                clusterBorder: '#cbd5e1',
                edgeLabelBackground: '#ffffff',
              },
        });

        const id = 'mmd-' + Math.random().toString(36).substring(2, 9);
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        if (!cancelled) {
          setSvg(renderedSvg);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to render Mermaid chart:', err);
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const stepZoom = (direction: 1 | -1) => {
    setZoom((z) => Math.min(3, Math.max(0.5, Math.round((z + direction * 0.25) * 100) / 100)));
  };

  if (hasError) {
    return (
      <div className="my-6 rounded-2xl border border-fd-border bg-fd-card p-4 font-mono text-xs">
        <p className="font-semibold text-fd-muted-foreground mb-2">Diagram Source View:</p>
        <pre className="overflow-x-auto text-[11px] p-3 rounded-xl bg-fd-muted text-fd-foreground">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-6 rounded-2xl border border-fd-border bg-fd-card/60 backdrop-blur-md p-4 shadow-sm relative group overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-fd-border/70 pb-2.5 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fd-muted-foreground font-medium">
          Architecture / Flowchart Diagram
        </span>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setExpanded(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-muted/50 px-2.5 py-1 font-mono text-[11px] text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted transition-all cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Expand</span>
        </button>
      </div>

      {/* SVG Container */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-xs font-mono text-fd-muted-foreground animate-pulse">
          Rendering interactive diagram...
        </div>
      ) : (
        <div
          className="hs-mermaid-svg overflow-x-auto flex justify-center py-2 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:transition-all"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {/* Fullscreen Modal Viewer */}
      {expanded && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-fd-background/98 backdrop-blur-xl animate-fade-rise">
          <div className="flex items-center justify-between border-b border-fd-border px-6 py-3.5">
            <span className="font-mono text-xs uppercase tracking-wider text-fd-foreground font-semibold">
              Diagram Fullscreen Viewer
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepZoom(-1)}
                className="p-1.5 rounded-lg border border-fd-border text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="w-14 text-center font-mono text-xs text-fd-foreground font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => stepZoom(1)}
                className="p-1.5 rounded-lg border border-fd-border text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1.5 rounded-lg border border-fd-border text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-muted px-3 py-1.5 font-mono text-xs text-fd-foreground hover:bg-fd-card cursor-pointer ml-2"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Close (ESC)</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-10 flex items-center justify-center">
            <div
              ref={viewerRef}
              className="origin-center transition-transform [&_svg]:max-w-none"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
