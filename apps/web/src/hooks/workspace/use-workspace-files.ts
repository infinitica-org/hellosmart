'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
  isReadOnly?: boolean;
}

export function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    default:
      return 'plaintext';
  }
}

export const DEFAULT_STARTER_FILES: WorkspaceFile[] = [
  {
    id: 'file_readme',
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: `# Assessment Solution Workspace

Welcome to your HelloSmart Cloud Workspace IDE.

## Getting Started
1. Review the requirements in the **Task Brief** tab.
2. Implement your business logic in \`src/solution.ts\`.
3. Add unit tests in \`tests/solution.test.ts\`.
4. Your code is continuously autosaved to the secure assessment cloud.
5. When finished, open the **Submission Panel** to record your deliverables.
`,
  },
  {
    id: 'file_solution',
    name: 'solution.ts',
    path: 'src/solution.ts',
    language: 'typescript',
    content: `/**
 * HelloSmart Take-Home Assessment Solution
 *
 * Candidate Implementation
 */

export interface EvaluationPayload {
  taskId: string;
  candidateInput: Record<string, unknown>;
  timestamp: number;
}

export interface EvaluationResult {
  status: 'passed' | 'failed';
  score: number;
  metadata?: Record<string, unknown>;
}

export class CandidateSolution {
  /**
   * Process assessment input and return verified evaluation result.
   */
  public execute(payload: EvaluationPayload): EvaluationResult {
    // TODO: Implement solution logic according to task specifications
    return {
      status: 'passed',
      score: 100,
      metadata: {
        taskId: payload.taskId,
        executedAt: new Date().toISOString(),
      },
    };
  }
}
`,
  },
  {
    id: 'file_test',
    name: 'solution.test.ts',
    path: 'tests/solution.test.ts',
    language: 'typescript',
    content: `import { CandidateSolution } from '../src/solution';

describe('CandidateSolution Verification Suite', () => {
  it('should process input payload and return valid structure', () => {
    const solution = new CandidateSolution();
    const result = solution.execute({
      taskId: 'task-stream-7',
      candidateInput: { sample: 'value' },
      timestamp: Date.now(),
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('passed');
  });
});
`,
  },
  {
    id: 'file_package',
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "candidate-assessment",
  "version": "1.0.0",
  "description": "Candidate assessment solution sandbox",
  "scripts": {
    "test": "vitest run",
    "build": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
`,
  },
];

export interface UseWorkspaceFilesOptions {
  assessmentId?: string;
  initialFiles?: WorkspaceFile[];
  onDirtyChange?: (isDirty: boolean) => void;
  onContentSync?: (files: WorkspaceFile[]) => void;
}

export function useWorkspaceFiles(options: UseWorkspaceFilesOptions = {}) {
  const { assessmentId, initialFiles = DEFAULT_STARTER_FILES, onDirtyChange, onContentSync } = options;

  // Initialize files from localStorage if available
  const [files, setFiles] = useState<WorkspaceFile[]>(() => {
    if (typeof window !== 'undefined' && assessmentId) {
      try {
        const cached = localStorage.getItem(`hs_workspace_files_${assessmentId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return initialFiles;
  });

  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && assessmentId) {
      try {
        const cached = localStorage.getItem(`hs_workspace_folders_${assessmentId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch {}
    }
    return ['src', 'tests'];
  });

  const [openFileIds, setOpenFileIds] = useState<string[]>(() =>
    files.slice(0, 3).map((f) => f.id)
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(() =>
    files.length > 0 ? files[0]!.id : null
  );

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist files and customFolders to localStorage and debounced sync callback
  const triggerDebouncedSync = useCallback(
    (updatedFiles: WorkspaceFile[]) => {
      if (typeof window !== 'undefined' && assessmentId) {
        try {
          localStorage.setItem(`hs_workspace_files_${assessmentId}`, JSON.stringify(updatedFiles));
        } catch {}
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        onContentSync?.(updatedFiles);
      }, 500);
    },
    [assessmentId, onContentSync]
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && assessmentId) {
      try {
        localStorage.setItem(`hs_workspace_folders_${assessmentId}`, JSON.stringify(customFolders));
      } catch {}
    }
  }, [assessmentId, customFolders]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const openFile = useCallback((fileId: string) => {
    setOpenFileIds((prev) => {
      if (!prev.includes(fileId)) {
        return [...prev, fileId];
      }
      return prev;
    });
    setActiveFileId(fileId);
  }, []);

  const closeFile = useCallback(
    (fileId: string) => {
      setOpenFileIds((prev) => {
        const next = prev.filter((id) => id !== fileId);
        if (activeFileId === fileId) {
          const remainingIndex = prev.indexOf(fileId);
          const nextActiveId =
            next[Math.max(0, remainingIndex - 1)] || next[0] || null;
          setActiveFileId(nextActiveId);
        }
        return next;
      });
    },
    [activeFileId]
  );

  const updateFileContent = useCallback(
    (fileId: string, newContent: string) => {
      setFiles((prev) => {
        const nextFiles = prev.map((file) => {
          if (file.id === fileId) {
            return {
              ...file,
              content: newContent,
              isDirty: true,
            };
          }
          return file;
        });

        onDirtyChange?.(true);
        triggerDebouncedSync(nextFiles);
        return nextFiles;
      });

      // Clear existing autoSave timer
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Auto-save: after 1.5 seconds of no typing, automatically clear dirty indicator
      // since the content has already been persisted to localStorage and queued to draft
      autoSaveTimeoutRef.current = setTimeout(() => {
        setFiles((prev) => {
          const hasDirty = prev.some((f) => f.isDirty);
          if (!hasDirty) return prev;
          return prev.map((f) => (f.isDirty ? { ...f, isDirty: false } : f));
        });
        onDirtyChange?.(false);
      }, 1500);
    },
    [onDirtyChange, triggerDebouncedSync]
  );

  const createFile = useCallback(
    (fileName: string, parentPath = ''): WorkspaceFile | null => {
      const cleanName = fileName.trim();
      if (!cleanName) return null;

      const normalizedParent = parentPath.replace(/^\/+|\/+$/g, '');
      const rawPath = normalizedParent
        ? `${normalizedParent}/${cleanName}`
        : cleanName;
      const normalizedPath = rawPath.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
      const leafName = normalizedPath.split('/').pop() || normalizedPath;

      // Duplicate path guard
      if (files.some((f) => f.path === normalizedPath)) {
        return null;
      }

      // Automatically register any intermediate folders
      const pathParts = normalizedPath.split('/');
      if (pathParts.length > 1) {
        const parentFolders: string[] = [];
        for (let i = 1; i < pathParts.length; i++) {
          parentFolders.push(pathParts.slice(0, i).join('/'));
        }
        setCustomFolders((prev) => Array.from(new Set([...prev, ...parentFolders])));
      }

      const newFile: WorkspaceFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: leafName,
        path: normalizedPath,
        content: '',
        language: detectLanguageFromPath(leafName),
        isDirty: true,
      };

      setFiles((prev) => {
        const next = [...prev, newFile];
        triggerDebouncedSync(next);
        return next;
      });

      setOpenFileIds((prev) => [...prev, newFile.id]);
      setActiveFileId(newFile.id);
      onDirtyChange?.(true);

      return newFile;
    },
    [files, onDirtyChange, triggerDebouncedSync]
  );

  const createFolder = useCallback(
    (folderName: string, parentPath = ''): boolean => {
      const cleanName = folderName.trim();
      if (!cleanName) return false;

      const normalizedParent = parentPath.replace(/^\/+|\/+$/g, '');
      const rawPath = normalizedParent
        ? `${normalizedParent}/${cleanName}`
        : cleanName;
      const normalizedPath = rawPath.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

      setCustomFolders((prev) => {
        if (prev.includes(normalizedPath)) return prev;
        const next = Array.from(new Set([...prev, normalizedPath]));
        return next;
      });

      onDirtyChange?.(true);
      return true;
    },
    [onDirtyChange]
  );

  const deleteFile = useCallback(
    (fileId: string) => {
      closeFile(fileId);
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== fileId);
        triggerDebouncedSync(next);
        return next;
      });
      onDirtyChange?.(true);
    },
    [closeFile, onDirtyChange, triggerDebouncedSync]
  );

  const deleteFolder = useCallback(
    (folderPath: string) => {
      const normalizedFolder = folderPath.replace(/^\/+|\/+$/g, '');
      const folderPrefix = `${normalizedFolder}/`;

      // Remove all files inside this folder
      const filesToDelete = files.filter(
        (f) => f.path === normalizedFolder || f.path.startsWith(folderPrefix)
      );

      for (const f of filesToDelete) {
        closeFile(f.id);
      }

      setFiles((prev) => {
        const next = prev.filter(
          (f) => f.path !== normalizedFolder && !f.path.startsWith(folderPrefix)
        );
        triggerDebouncedSync(next);
        return next;
      });

      setCustomFolders((prev) =>
        prev.filter((f) => f !== normalizedFolder && !f.startsWith(folderPrefix))
      );

      onDirtyChange?.(true);
    },
    [files, closeFile, onDirtyChange, triggerDebouncedSync]
  );

  const markAllClean = useCallback(() => {
    setFiles((prev) => {
      const hasDirty = prev.some((f) => f.isDirty);
      if (!hasDirty) return prev;
      return prev.map((f) => (f.isDirty ? { ...f, isDirty: false } : f));
    });
  }, []);

  const refreshFiles = useCallback(() => {
    if (typeof window !== 'undefined' && assessmentId) {
      try {
        const cached = localStorage.getItem(`hs_workspace_files_${assessmentId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFiles(parsed);
            return;
          }
        }
      } catch {}
    }
    setFiles(initialFiles);
  }, [assessmentId, initialFiles]);

  return {
    files,
    customFolders,
    openFileIds,
    activeFileId,
    activeFile,
    openFile,
    closeFile,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    updateFileContent,
    markAllClean,
    refreshFiles,
    setActiveFileId,
  };
}

