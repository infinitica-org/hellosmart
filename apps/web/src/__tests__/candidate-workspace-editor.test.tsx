import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  detectLanguageFromPath,
  DEFAULT_STARTER_FILES,
  type WorkspaceFile,
} from '../hooks/workspace/use-workspace-files';
import { FileTree } from '../components/workspace/editor/file-tree';
import { EditorTabs, getFileIcon } from '../components/workspace/editor/editor-tabs';
import {
  editorViewStateCache,
  getCachedEditorViewState,
  clearEditorViewStateCache,
} from '../components/workspace/editor/monaco-code-editor';

describe('Stream 7.1 – Workspace Editor & File Explorer (S1B-T07-1 / CA-008)', () => {
  describe('Language Detection & Starter Files', () => {
    it('detects language based on file extension correctly', () => {
      expect(detectLanguageFromPath('index.ts')).toBe('typescript');
      expect(detectLanguageFromPath('component.tsx')).toBe('typescript');
      expect(detectLanguageFromPath('script.py')).toBe('python');
      expect(detectLanguageFromPath('main.go')).toBe('go');
      expect(detectLanguageFromPath('package.json')).toBe('json');
      expect(detectLanguageFromPath('doc.md')).toBe('markdown');
      expect(detectLanguageFromPath('unknown.xyz')).toBe('plaintext');
    });

    it('contains essential starter files in DEFAULT_STARTER_FILES', () => {
      expect(DEFAULT_STARTER_FILES.length).toBeGreaterThanOrEqual(3);
      const paths = DEFAULT_STARTER_FILES.map((f) => f.path);
      expect(paths).toContain('README.md');
      expect(paths).toContain('src/solution.ts');
      expect(paths).toContain('package.json');
    });
  });

  describe('FileTree Component (21st.dev Pattern)', () => {
    it('renders folder structure and file items', () => {
      const files: WorkspaceFile[] = [
        { id: '1', name: 'README.md', path: 'README.md', content: '', language: 'markdown' },
        { id: '2', name: 'solution.ts', path: 'src/solution.ts', content: '', language: 'typescript' },
      ];

      const html = renderToString(
        <FileTree
          files={files}
          activeFileId="2"
          onSelectFile={vi.fn()}
          onCreateFile={vi.fn()}
          onDeleteFile={vi.fn()}
        />
      );

      expect(html).toContain('Explorer');
      expect(html).toContain('README.md');
      expect(html).toContain('src');
      expect(html).toContain('solution.ts');
    });
  });

  describe('EditorTabs Component', () => {
    it('renders open tabs with active file highlight and dirty indicators', () => {
      const files: WorkspaceFile[] = [
        { id: '1', name: 'solution.ts', path: 'src/solution.ts', content: 'code', language: 'typescript', isDirty: true },
        { id: '2', name: 'README.md', path: 'README.md', content: '# Readme', language: 'markdown' },
      ];

      const html = renderToString(
        <EditorTabs
          files={files}
          openFileIds={['1', '2']}
          activeFileId="1"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />
      );

      expect(html).toContain('solution.ts');
      expect(html).toContain('README.md');
      expect(html).toContain('Unsaved changes');
    });

    it('renders clean fallback when zero tabs are open', () => {
      const html = renderToString(
        <EditorTabs
          files={[]}
          openFileIds={[]}
          activeFileId={null}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />
      );

      expect(html).toContain('No open files');
    });

    it('renders with light theme (clean white and orange) mode correctly', () => {
      const files: WorkspaceFile[] = [
        { id: '1', name: 'main.py', path: 'main.py', content: 'print("hello")', language: 'python' },
      ];

      const lightHtml = renderToString(
        <EditorTabs
          files={files}
          openFileIds={['1']}
          activeFileId="1"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          theme="light"
        />
      );
      expect(lightHtml).toContain('main.py');
      expect(lightHtml).toContain('bg-white');
      expect(lightHtml).toContain('border-t-primary');

      const darkHtml = renderToString(
        <EditorTabs
          files={files}
          openFileIds={['1']}
          activeFileId="1"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          theme="dark"
        />
      );
      expect(darkHtml).toContain('main.py');
      expect(darkHtml).toContain('bg-[#1e1e1e]');
    });
  });

  describe('FileTree Theming', () => {
    it('applies clean white & orange light theme classes', () => {
      const files: WorkspaceFile[] = [
        { id: '1', name: 'README.md', path: 'README.md', content: '', language: 'markdown' },
      ];

      const lightTree = renderToString(
        <FileTree
          files={files}
          activeFileId="1"
          onSelectFile={vi.fn()}
          onCreateFile={vi.fn()}
          onDeleteFile={vi.fn()}
          theme="light"
        />
      );
      expect(lightTree).toContain('bg-white');
      expect(lightTree).toContain('text-primary');

      const darkTree = renderToString(
        <FileTree
          files={files}
          activeFileId="1"
          onSelectFile={vi.fn()}
          onCreateFile={vi.fn()}
          onDeleteFile={vi.fn()}
          theme="dark"
        />
      );
      expect(darkTree).toContain('bg-[#181818]');
    });
  });

  describe('Syntax Icons & File Tree Integration', () => {
    it('returns distinctive syntax icons for language extensions', () => {
      const tsHtml = renderToString(getFileIcon('app.ts'));
      expect(tsHtml).toContain('text-blue-400');

      const pyHtml = renderToString(getFileIcon('script.py'));
      expect(pyHtml).toContain('text-yellow-400');

      const goHtml = renderToString(getFileIcon('main.go'));
      expect(goHtml).toContain('text-cyan-400');

      const jsonHtml = renderToString(getFileIcon('config.json'));
      expect(jsonHtml).toContain('text-amber-400');
    });

    it('renders language-specific syntax icons inside the FileTree explorer', () => {
      const files: WorkspaceFile[] = [
        { id: '1', name: 'main.py', path: 'main.py', content: 'print(1)', language: 'python' },
        { id: '2', name: 'data.json', path: 'data.json', content: '{}', language: 'json' },
      ];

      const html = renderToString(
        <FileTree
          files={files}
          activeFileId="1"
          onSelectFile={vi.fn()}
          onCreateFile={vi.fn()}
          onDeleteFile={vi.fn()}
        />
      );

      // Verify extension icons are rendered
      expect(html).toContain('text-yellow-400');
      expect(html).toContain('text-amber-400');
    });
  });

  describe('Monaco ViewState Preservation Across Tab Switches', () => {
    it('manages view state cache for preserving cursor and scroll state', () => {
      clearEditorViewStateCache();

      const mockViewState = {
        cursorState: [{ inSelectionMode: false, position: { lineNumber: 42, column: 15 } }],
        viewState: { scrollTop: 350, scrollLeft: 0 },
      };

      editorViewStateCache.set('src/solution.ts', mockViewState);

      expect(getCachedEditorViewState('src/solution.ts')).toEqual(mockViewState);
      expect(getCachedEditorViewState('tests/solution.test.ts')).toBeUndefined();

      clearEditorViewStateCache();
      expect(getCachedEditorViewState('src/solution.ts')).toBeUndefined();
    });
  });
});
