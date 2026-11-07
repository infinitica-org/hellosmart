'use client';

import React from 'react';
import { X, FileCode2, FileCode, FileJson, FileText, File } from 'lucide-react';
import type { WorkspaceFile } from '@/hooks/workspace/use-workspace-files';
import type { WorkspaceTheme } from './monaco-code-editor';

export interface EditorTabsProps {
  files: WorkspaceFile[];
  openFileIds: string[];
  activeFileId: string | null;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  theme?: WorkspaceTheme;
}

export function getFileIcon(fileName: string, className = 'w-3.5 h-3.5') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode2 className={`${className} text-blue-400 shrink-0`} />;
    case 'py':
      return <FileCode className={`${className} text-yellow-400 shrink-0`} />;
    case 'go':
      return <FileCode className={`${className} text-cyan-400 shrink-0`} />;
    case 'json':
      return <FileJson className={`${className} text-amber-400 shrink-0`} />;
    case 'md':
      return <FileText className={`${className} text-neutral-400 shrink-0`} />;
    default:
      return <File className={`${className} text-neutral-400 shrink-0`} />;
  }
}

export const getTabIcon = getFileIcon;

export function EditorTabs({
  files,
  openFileIds,
  activeFileId,
  onSelectTab,
  onCloseTab,
  theme = 'dark',
}: EditorTabsProps) {
  const openFiles = openFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is WorkspaceFile => Boolean(f));

  if (openFiles.length === 0) {
    const emptyBg =
      theme === 'light'
        ? 'bg-neutral-50 border-b border-neutral-200 text-neutral-400'
        : 'bg-neutral-900 border-b border-neutral-800 text-neutral-500';

    return (
      <div className={`h-9 flex items-center px-3 text-xs select-none ${emptyBg}`}>
        No open files
      </div>
    );
  }

  const stripBg =
    theme === 'light'
      ? 'bg-neutral-50 border-b border-neutral-200'
      : 'bg-neutral-950 border-b border-neutral-800';

  return (
    <div className={`flex items-center h-9 overflow-x-auto no-scrollbar select-none ${stripBg}`}>
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;

        const tabStyle =
          theme === 'light'
            ? isActive
              ? 'bg-white text-neutral-900 font-semibold border-t-2 border-t-primary border-r border-neutral-200 shadow-2xs'
              : 'bg-neutral-50 text-neutral-600 hover:text-neutral-900 hover:bg-white border-r border-neutral-200'
            : isActive
              ? 'bg-neutral-900 text-white font-medium border-t-2 border-t-primary border-r border-neutral-800'
              : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border-r border-neutral-800';

        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file.id)}
            className={`group relative flex items-center gap-2 px-3 h-full text-xs font-mono cursor-pointer transition-colors shrink-0 ${tabStyle}`}
          >
            {getTabIcon(file.name)}
            <span className="truncate max-w-[140px]">{file.name}</span>

            {/* Dirty Unsaved Dot or Close Button */}
            <div className="flex items-center justify-center w-4 h-4 ml-1">
              {file.isDirty ? (
                <span
                  title="Unsaved changes"
                  className="w-2 h-2 rounded-full bg-primary group-hover:hidden"
                />
              ) : null}

              <button
                type="button"
                title="Close file"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id);
                }}
                className={`p-0.5 rounded transition-colors ${
                  theme === 'light'
                    ? 'text-neutral-400 hover:text-danger hover:bg-red-50'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700/60'
                } ${file.isDirty ? 'hidden group-hover:flex' : 'flex'}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

