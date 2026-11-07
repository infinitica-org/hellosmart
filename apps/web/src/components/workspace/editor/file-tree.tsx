'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  RotateCw,
  FoldVertical,
  Trash2,
  FileCode
} from 'lucide-react';
import type { WorkspaceFile } from '@/hooks/workspace/use-workspace-files';
import type { WorkspaceTheme } from './monaco-code-editor';
import { getFileIcon } from './editor-tabs';

export interface FileTreeProps {
  files: WorkspaceFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (fileName: string, parentPath?: string) => void;
  onCreateFolder?: (folderName: string, parentPath?: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onRefresh?: () => void;
  customFolders?: string[];
  theme?: WorkspaceTheme;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  fileId?: string | undefined;
  children?: TreeNode[] | undefined;
}

function buildTree(files: WorkspaceFile[], customFolders: string[] = []): TreeNode[] {
  const root: TreeNode[] = [];

  const ensureFolderNode = (folderPath: string) => {
    const parts = folderPath.split('/').filter(Boolean);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existingNode = currentLevel.find((n) => n.name === part && n.type === 'folder');
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: 'folder',
          children: [],
        };
        currentLevel.push(existingNode);
      }
      currentLevel = existingNode.children!;
    }
  };

  for (const folder of customFolders) {
    ensureFolderNode(folder);
  }

  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existingNode = currentLevel.find((n) => n.name === part);

      if (!existingNode) {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
        };
        if (isFile) {
          newNode.fileId = file.id;
        } else {
          newNode.children = [];
        }
        currentLevel.push(newNode);
        existingNode = newNode;
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  // Sort folders first, then alphabetical
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root);
  return root;
}

interface ContextMenuState {
  x: number;
  y: number;
  targetFolder: string | null;
  targetFileId?: string | null;
  targetFileName?: string | null;
}

export function FileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRefresh,
  customFolders = ['src', 'tests'],
  theme = 'dark',
}: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    () => new Set(['src', 'tests'])
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [creationModal, setCreationModal] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [inputName, setInputName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const tree = useMemo(() => buildTree(files, customFolders), [files, customFolders]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setCreationModal(null);
      }
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFolder = (folderPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFolder(folderPath);
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleSelectFile = (fileId: string, filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onSelectFile(fileId);
    // In VS Code, selecting a file sets the target folder to that file's parent directory
    const parts = filePath.split('/');
    if (parts.length > 1) {
      setSelectedFolder(parts.slice(0, -1).join('/'));
    } else {
      setSelectedFolder(null);
    }
  };

  const startCreation = (type: 'file' | 'folder', targetFolder: string | null = selectedFolder) => {
    const parent = targetFolder || '';
    if (parent) {
      setOpenFolders((prev) => new Set([...prev, parent]));
    }
    setCreationModal({ type, parentPath: parent });
    setInputName('');
  };

  const handleCreationSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputName.trim();
    if (!trimmed || !creationModal) {
      setCreationModal(null);
      setInputName('');
      return;
    }

    if (creationModal.type === 'file') {
      onCreateFile(trimmed, creationModal.parentPath);
    } else {
      onCreateFolder?.(trimmed, creationModal.parentPath);
    }

    if (creationModal.parentPath) {
      setOpenFolders((prev) => new Set([...prev, creationModal.parentPath]));
    }

    // Automatically expand and select the newly created path
    const createdFullPath = creationModal.parentPath
      ? `${creationModal.parentPath}/${trimmed}`
      : trimmed;

    if (creationModal.type === 'folder') {
      setOpenFolders((prev) => new Set([...prev, createdFullPath]));
      setSelectedFolder(createdFullPath);
    }

    setCreationModal(null);
    setInputName('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setCreationModal(null);
      setInputName('');
    }
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFolder(folderPath);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetFolder: folderPath,
    });
  };

  const handleFileContextMenu = (e: React.MouseEvent, fileId: string, fileName: string, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const parts = filePath.split('/');
    const parentFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
    setSelectedFolder(parentFolder);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetFolder: parentFolder,
      targetFileId: fileId,
      targetFileName: fileName,
    });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetFolder: selectedFolder,
    });
  };

  const renderCreationInput = (parentPath: string) => {
    if (!creationModal || creationModal.parentPath !== parentPath) return null;

    const isFolder = creationModal.type === 'folder';

    return (
      <form
        onSubmit={handleCreationSubmit}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded my-1 border shadow-xs ${
          theme === 'light'
            ? 'bg-orange-50/90 border-primary/40 text-neutral-900'
            : 'bg-neutral-800/90 border-neutral-600 text-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isFolder ? (
          <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
        ) : (
          <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
        {parentPath && (
          <span className="text-[10px] font-mono font-medium text-neutral-400 shrink-0">
            {parentPath}/
          </span>
        )}
        <input
          type="text"
          autoFocus
          placeholder={isFolder ? 'folder_name' : 'filename.ts'}
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          onBlur={handleCreationSubmit}
          onKeyDown={handleInputKeyDown}
          className={`w-full bg-transparent text-xs focus:outline-none font-mono ${
            theme === 'light'
              ? 'text-neutral-900 placeholder:text-neutral-400'
              : 'text-white placeholder:text-neutral-500'
          }`}
        />
      </form>
    );
  };

  const renderNodes = (nodes: TreeNode[], parentPath = '') => {
    return (
      <>
        {renderCreationInput(parentPath)}
        {nodes.map((node) => {
          if (node.type === 'folder') {
            const isOpen = openFolders.has(node.path);
            const isSelected = selectedFolder === node.path;

            const folderHover =
              theme === 'light'
                ? isSelected
                  ? 'bg-orange-100/70 text-primary font-semibold border border-orange-200/80 shadow-2xs'
                  : 'hover:bg-orange-50/70 text-neutral-800 hover:text-primary'
                : isSelected
                  ? 'bg-neutral-800 text-primary font-medium border border-neutral-700 shadow-xs'
                  : 'hover:bg-neutral-800/60 text-neutral-300 hover:text-white';

            const branchLine =
              theme === 'light'
                ? 'border-neutral-200'
                : 'border-neutral-700/60';

            return (
              <div key={node.path} className="select-none">
                <div
                  className={`group w-full flex items-center justify-between py-1 px-2 text-xs rounded-md cursor-pointer transition-colors ${folderHover}`}
                  onClick={(e) => toggleFolder(node.path, e)}
                  onContextMenu={(e) => handleFolderContextMenu(e, node.path)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <FolderOpen className={`w-4 h-4 stroke-[1.5] shrink-0 ${theme === 'light' ? 'text-primary' : 'text-neutral-300'}`} />
                    ) : (
                      <Folder className={`w-4 h-4 stroke-[1.5] shrink-0 ${theme === 'light' ? 'text-primary/80' : 'text-neutral-400'}`} />
                    )}
                    <span className="truncate">{node.name}</span>
                  </div>

                  {/* Context Actions on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      title={`New File inside ${node.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startCreation('file', node.path);
                      }}
                      className="p-0.5 rounded hover:text-primary transition-colors cursor-pointer"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title={`New Folder inside ${node.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startCreation('folder', node.path);
                      }}
                      className="p-0.5 rounded hover:text-primary transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteFolder && (
                      <button
                        type="button"
                        title={`Delete folder ${node.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete folder "${node.name}" and all its contents?`)) {
                            onDeleteFolder(node.path);
                          }
                        }}
                        className="p-0.5 rounded hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className={`relative ml-2.5 pl-3 border-l space-y-0.5 my-0.5 ${branchLine}`}>
                    {renderNodes(node.children || [], node.path)}
                  </div>
                )}
              </div>
            );
          }

          const isActive = node.fileId === activeFileId;

          const fileItemStyle =
            theme === 'light'
              ? isActive
                ? 'bg-orange-100/70 text-neutral-900 font-medium border border-orange-200/80 shadow-2xs'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-orange-50/50'
              : isActive
                ? 'bg-neutral-800 text-white font-medium border border-neutral-700/60 shadow-xs'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60';

          return (
            <div
              key={node.path}
              className={`group flex items-center justify-between py-1 px-2 text-xs rounded-md cursor-pointer transition-colors ${fileItemStyle}`}
              onClick={(e) => node.fileId && handleSelectFile(node.fileId, node.path, e)}
              onContextMenu={(e) => node.fileId && handleFileContextMenu(e, node.fileId, node.name, node.path)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(node.name, 'w-3.5 h-3.5')}
                <span className="truncate">{node.name}</span>
              </div>

              {node.fileId && (
                <button
                  type="button"
                  title="Delete File"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete file "${node.name}"?`)) {
                      onDeleteFile(node.fileId!);
                    }
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all shrink-0 ml-1 cursor-pointer ${
                    theme === 'light'
                      ? 'text-neutral-400 hover:text-danger hover:bg-red-50'
                      : 'text-neutral-500 hover:text-danger hover:bg-neutral-700/60'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const containerStyle =
    theme === 'light'
      ? 'bg-white border-r border-neutral-200 text-neutral-800'
      : 'bg-neutral-950 border-r border-neutral-800 text-neutral-300';

  const headerStyle =
    theme === 'light'
      ? 'border-b border-neutral-200 bg-white text-neutral-900'
      : 'border-b border-neutral-800/80 bg-neutral-900 text-neutral-400';

  const contextMenuStyle =
    theme === 'light'
      ? 'bg-white border-neutral-200 text-neutral-800 shadow-xl'
      : 'bg-neutral-900 border-neutral-700 text-neutral-200 shadow-2xl';

  return (
    <div
      className={`flex flex-col h-full text-xs overflow-hidden select-none relative ${containerStyle}`}
      onClick={() => setSelectedFolder(null)}
      onContextMenu={handleBackgroundContextMenu}
    >
      {/* Explorer Header with VS Code Action Icons */}
      <div className={`shrink-0 flex items-center justify-between px-3 py-2 ${headerStyle}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-bold uppercase tracking-wider font-mono">
            Explorer
          </span>
          {selectedFolder && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium truncate max-w-[100px] bg-primary/10 text-primary border border-primary/20"
              title={`Selected folder: ${selectedFolder}`}
            >
              {selectedFolder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* 1. New File in Selected Folder or Root */}
          <button
            type="button"
            title={selectedFolder ? `New File inside '${selectedFolder}'` : 'New File (at root)'}
            onClick={() => startCreation('file', selectedFolder)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-neutral-500 hover:text-primary hover:bg-orange-50'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          {/* 2. New Folder in Selected Folder or Root */}
          <button
            type="button"
            title={selectedFolder ? `New Folder inside '${selectedFolder}'` : 'New Folder (at root)'}
            onClick={() => startCreation('folder', selectedFolder)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-neutral-500 hover:text-primary hover:bg-orange-50'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {/* 3. Refresh Explorer */}
          <button
            type="button"
            title="Refresh Explorer"
            onClick={() => onRefresh?.()}
            className={`p-1 rounded transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-neutral-500 hover:text-primary hover:bg-orange-50'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* 4. Collapse Folders */}
          <button
            type="button"
            title="Collapse Folders in Explorer"
            onClick={() => setOpenFolders(new Set())}
            className={`p-1 rounded transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-neutral-500 hover:text-primary hover:bg-orange-50'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FoldVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {renderNodes(tree, '')}
      </div>

      {/* VS Code Style Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight - 160 : 400)), left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth - 180 : 200)) }}
          className={`fixed z-50 py-1 rounded-lg border text-xs min-w-[160px] ${contextMenuStyle}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              startCreation('file', contextMenu.targetFolder);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-primary" />
            <span>New File...</span>
          </button>
          <button
            type="button"
            onClick={() => {
              startCreation('folder', contextMenu.targetFolder);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-primary" />
            <span>New Folder...</span>
          </button>

          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700/80" />

          <button
            type="button"
            onClick={() => {
              onRefresh?.();
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Explorer</span>
          </button>

          {contextMenu.targetFileId && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete file "${contextMenu.targetFileName}"?`)) {
                  onDeleteFile(contextMenu.targetFileId!);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-danger hover:bg-danger/10 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete File</span>
            </button>
          )}

          {contextMenu.targetFolder && onDeleteFolder && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete folder "${contextMenu.targetFolder}" and all its contents?`)) {
                  onDeleteFolder(contextMenu.targetFolder!);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-danger hover:bg-danger/10 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Folder</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
