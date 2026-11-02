'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileArchive, CheckCircle2, AlertCircle, X, RotateCcw, Loader2 } from 'lucide-react';
import type { UploadedArtifactMetadata } from '@hs/contracts';

const MAX_FILE_SIZE = 52428800; // 50 MB (50 * 1024 * 1024)
const ALLOWED_EXTS = ['.zip', '.tar', '.gz', '.tgz'];

export interface DeliverablesUploaderProps {
  artifact: UploadedArtifactMetadata | null;
  onArtifactChange: (artifact: UploadedArtifactMetadata | null) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function DeliverablesUploader({
  artifact,
  onArtifactChange,
  onUploadStateChange,
  className = '',
}: DeliverablesUploaderProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds the maximum 50 MB limit (${formatBytes(file.size)}).`;
    }
    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      return 'Unsupported file format. Please upload a .zip, .tar, .tar.gz, or .tgz archive.';
    }
    return null;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const errorMsg = validateFile(file);
      if (errorMsg) {
        setUploadError(errorMsg);
        return;
      }

      setUploadError(null);
      setUploadProgress(10);
      onUploadStateChange?.(true);

      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploadProgress(40);
        const res = await fetch('/api/candidate/artifacts/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.message || `Upload failed with status ${res.status}`);
        }

        setUploadProgress(85);
        const metadata: UploadedArtifactMetadata = await res.json();
        setUploadProgress(100);

        setTimeout(() => {
          onArtifactChange(metadata);
          setUploadProgress(null);
          onUploadStateChange?.(false);
        }, 300);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed. Please retry.';
        setUploadError(message);
        setUploadProgress(null);
        onUploadStateChange?.(false);
      }
    },
    [onArtifactChange, onUploadStateChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles && droppedFiles.length > 0 && droppedFiles[0]) {
        void uploadFile(droppedFiles[0]);
      }
    },
    [uploadFile]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0 && selectedFiles[0]) {
      void uploadFile(selectedFiles[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onArtifactChange(null);
    setUploadError(null);
    setUploadProgress(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.tar,.gz,.tgz,application/zip,application/x-tar,application/gzip"
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-upload-input"
      />

      {artifact ? (
        <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <FileArchive className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {artifact.originalName}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <span className="text-neutral-500 text-[11px] block">
                {formatBytes(artifact.sizeBytes)} &bull; Uploaded to secure storage
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Remove archive"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : uploadProgress !== null ? (
        <div className="p-5 rounded-xl border border-primary/40 bg-orange-50/40 dark:bg-neutral-900 space-y-2 text-xs">
          <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
            <span className="font-medium flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Uploading Solution Archive...
            </span>
            <span className="font-mono font-semibold text-primary">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-primary bg-orange-50/60 dark:bg-orange-950/20'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-primary/60 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 bg-neutral-50/40 dark:bg-neutral-900/40'
          }`}
          data-testid="dropzone-container"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-primary mx-auto flex items-center justify-center mb-2">
            <UploadCloud className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
            Drag &amp; drop solution archive, or <span className="text-primary font-semibold hover:underline">browse files</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Supports .zip, .tar, .tar.gz &bull; Up to 50 MB
          </p>
        </div>
      )}

      {uploadError && (
        <div
          data-testid="upload-error-alert"
          className="flex items-center justify-between gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 font-semibold hover:underline text-red-700 shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

