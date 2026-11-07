'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { loader, type OnMount, type OnChange, type Monaco } from '@monaco-editor/react';
import { Loader2, AlertTriangle, Code2 } from 'lucide-react';
import type { WorkspaceFile } from '@/hooks/workspace/use-workspace-files';

/**
 * Cache mapping file paths to their respective Monaco ICodeEditorViewState.
 * Preserves cursor positions, scroll offsets, and selections across tab switching.
 */
export const editorViewStateCache = new Map<string, any>();

export function getCachedEditorViewState(path: string): any {
  return editorViewStateCache.get(path);
}

export function clearEditorViewStateCache(): void {
  editorViewStateCache.clear();
}

// Configure Monaco loader to use local static assets served from /monaco/vs
// Eliminates external CDN dependencies, works offline, and complies with CSP
if (typeof window !== 'undefined') {
  loader.config({
    paths: {
      vs: '/monaco/vs',
    },
  });
}

export type WorkspaceTheme = 'dark' | 'light';

export interface MonacoCodeEditorProps {
  file: WorkspaceFile | null;
  onChange?: (newContent: string) => void;
  onMount?: OnMount;
  onSave?: () => void;
  readOnly?: boolean;
  theme?: WorkspaceTheme;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB guard

export function MonacoCodeEditor({
  file,
  onChange,
  onMount,
  onSave,
  readOnly = false,
  theme = 'dark',
}: MonacoCodeEditorProps) {
  const editorRef = useRef<any>(null);
  const activePathRef = useRef<string | null>(file?.path ?? null);

  const saveCurrentViewState = useCallback(() => {
    const editor = editorRef.current;
    const currentPath = activePathRef.current;
    if (editor && currentPath) {
      try {
        const state = editor.saveViewState();
        if (state) {
          editorViewStateCache.set(currentPath, state);
        }
      } catch {}
    }
  }, []);

  // When active file changes: save previous file view state and restore new file view state
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !file?.path) return;

    const previousPath = activePathRef.current;
    if (previousPath && previousPath !== file.path) {
      saveCurrentViewState();
    }

    activePathRef.current = file.path;

    const savedState = editorViewStateCache.get(file.path);
    if (savedState) {
      // Defer to next frame so Monaco's model swap has completed
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          if (editorRef.current && activePathRef.current === file.path) {
            try {
              editorRef.current.restoreViewState(savedState);
              editorRef.current.focus();
            } catch {}
          }
        });
      }
    } else {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          if (editorRef.current && activePathRef.current === file.path) {
            try {
              editorRef.current.focus();
            } catch {}
          }
        });
      }
    }
  }, [file?.path, saveCurrentViewState]);

  // Clean up and save view state on unmount
  useEffect(() => {
    return () => {
      saveCurrentViewState();
    };
  }, [saveCurrentViewState]);

  if (!file) {
    const bgClass =
      theme === 'light'
        ? 'bg-white text-neutral-400'
        : 'bg-[#1e1e1e] text-neutral-500';

    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-xs space-y-2 select-none ${bgClass}`}>
        <Code2 className="w-8 h-8 opacity-60" />
        <p className="font-mono">Select a file from the explorer to begin editing</p>
      </div>
    );
  }

  // Guard against oversized files crashing the browser tab
  if (file.content && file.content.length > MAX_FILE_SIZE_BYTES) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1e1e1e] text-warning text-xs space-y-2 select-none">
        <AlertTriangle className="w-8 h-8 text-warning" />
        <p className="font-semibold">File exceeds 2 MB safety threshold</p>
        <p className="text-neutral-400 max-w-sm text-center">
          To prevent browser tab freezing, editing files larger than 2 MB is disabled.
        </p>
      </div>
    );
  }

  const handleChange: OnChange = (value) => {
    onChange?.(value ?? '');
  };

  const handleBeforeMount = (monaco: Monaco) => {
    // Inject ambient types for Vitest / Jest testing globals so candidate code doesn't show false squiggly errors
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare function describe(name: string, fn: () => void): void;
      declare function it(name: string, fn: () => void | Promise<void>): void;
      declare function test(name: string, fn: () => void | Promise<void>): void;
      declare function expect(actual: any): {
        toBe(expected: any): void;
        toEqual(expected: any): void;
        toBeDefined(): void;
        toBeUndefined(): void;
        toBeTruthy(): void;
        toBeFalsy(): void;
        toContain(expected: any): void;
        toThrow(expected?: any): void;
        resolves: any;
        rejects: any;
        not: any;
        [key: string]: any;
      };
      declare function beforeEach(fn: () => void | Promise<void>): void;
      declare function afterEach(fn: () => void | Promise<void>): void;
      declare function beforeAll(fn: () => void | Promise<void>): void;
      declare function afterAll(fn: () => void | Promise<void>): void;
      declare const vi: any;
      declare const jest: any;
      `,
      'ts:vitest-globals.d.ts'
    );

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      `
      declare function describe(name: string, fn: () => void): void;
      declare function it(name: string, fn: () => void | Promise<void>): void;
      declare function test(name: string, fn: () => void | Promise<void>): void;
      declare function expect(actual: any): any;
      `,
      'js:vitest-globals.d.ts'
    );

    // Suppress ambient type missing and module import resolution errors (2304, 2582, 2593, 2307, 7016)
    // so candidates writing standard test suites and relative imports don't see distracting red squiggly lines
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2304, 2582, 2593, 2307, 7016],
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2304, 2582, 2593, 2307, 7016],
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTextExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      noEmit: true,
    });
  };

  const monacoTheme = theme === 'light' ? 'light' : 'vs-dark';
  const containerBg = theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]';

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    activePathRef.current = file?.path ?? null;

    if (file?.path) {
      const savedState = editorViewStateCache.get(file.path);
      if (savedState) {
        try {
          editor.restoreViewState(savedState);
        } catch {}
      }
    }

    // Persist view state on cursor position changes and scroll changes
    editor.onDidChangeCursorPosition(() => {
      saveCurrentViewState();
    });

    editor.onDidScrollChange(() => {
      saveCurrentViewState();
    });

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });
    }
    onMount?.(editor, monaco);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden flex-1 ${containerBg}`}>
      <Editor
        path={file.path}
        language={file.language}
        value={file.content}
        theme={monacoTheme}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        loading={
          <div className="w-full h-full flex flex-col items-center justify-center text-xs space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="font-mono text-neutral-400">Initializing Monaco editor runtime...</span>
          </div>
        }
        options={{
          readOnly: Boolean(readOnly || file.isReadOnly),
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', monospace",
          lineNumbers: 'on',
          minimap: { enabled: true, maxColumn: 80 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
        }}
      />
    </div>
  );
}
