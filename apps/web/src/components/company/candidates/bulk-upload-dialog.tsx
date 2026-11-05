'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  Button,
  TextureButton,
  Badge,
  Alert,
  Spinner,
  Upload,
  Download,
  FileText,
  Check,
  AlertTriangle,
  X,
} from '@hs/ui';
import {
  validateCandidateCsv,
  generateSampleCsvTemplate,
  exportErrorsToCsv,
  MAX_CSV_FILE_SIZE_BYTES,
  MAX_CSV_ROW_LIMIT,
} from '@/lib/candidate-csv';
import type {
  BulkCandidateError,
  BulkCandidateUploadResponse,
  CreateCandidateDto,
  CsvValidationPreview,
} from './types';
import { ApiError } from '@/lib/api-client';
import { ALERT_MESSAGES, UI_LABELS, LIMITS } from '@/constants';

export interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (candidates: CreateCandidateDto[]) => Promise<BulkCandidateUploadResponse>;
  existingEmails?: Set<string>;
  isSubmitting?: boolean;
}

type UploadStep = 'select' | 'preview' | 'summary';

export function BulkUploadDialog({
  open,
  onOpenChange,
  onImport,
  existingEmails,
  isSubmitting = false,
}: BulkUploadDialogProps) {
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvValidationPreview | null>(null);
  const [importResult, setImportResult] = useState<BulkCandidateUploadResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep('select');
    setSelectedFile(null);
    setIsDragging(false);
    setFileError(null);
    setPreview(null);
    setImportResult(null);
    setApiError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onOpenChange(false);
  };

  const processFile = async (file: File) => {
    setFileError(null);
    setApiError(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please select a valid .csv file.');
      return;
    }

    if (file.size > LIMITS.CSV.MAX_SIZE_BYTES) {
      setFileError(`${ALERT_MESSAGES.CSV.FILE_TOO_LARGE} (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    try {
      const text = await file.text();
      const validation = validateCandidateCsv(text, { existingEmails });

      if (!validation.success) {
        setFileError(validation.error || 'Failed to parse CSV file.');
        return;
      }

      setSelectedFile(file);
      setPreview(validation.preview);
      setStep('preview');
    } catch {
      setFileError('Failed to read or parse the selected file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleCsvTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'candidates_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrors = (errors: BulkCandidateError[]) => {
    const csvContent = exportErrorsToCsv(errors);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `candidate_import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleProceedImport = async () => {
    if (!preview || preview.validRows.length === 0) return;
    setApiError(null);

    const candidatePayload: CreateCandidateDto[] = preview.validRows.map((r) => ({
      name: r.name,
      email: r.email,
    }));

    try {
      const response = await onImport(candidatePayload);
      setImportResult(response);
      setStep('summary');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('Bulk import failed. Please check your data and try again.');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
      title="Bulk Upload Candidates"
      description="Import multiple candidates simultaneously via CSV with automatic validation and duplicate detection."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          {step === 'select' && (
            <>
              <TextureButton
                variant="secondary"
                size="sm"
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample CSV</span>
              </TextureButton>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                {UI_LABELS.BUTTONS.CANCEL}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                disabled={isSubmitting}
              >
                Choose Another File
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleProceedImport}
                disabled={isSubmitting || !preview || preview.validRows.length === 0}
                className="flex items-center gap-2"
              >
                {isSubmitting && <Spinner size="sm" />}
                <span>
                  {isSubmitting
                    ? 'Importing...'
                    : `Import ${preview?.validRows.length ?? 0} Valid Candidates`}
                </span>
              </Button>
            </>
          )}

          {step === 'summary' && (
            <div className="flex w-full items-center justify-end">
              <Button variant="primary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {apiError && (
          <Alert variant="error" title="Import Error">
            {apiError}
          </Alert>
        )}

        {/* STEP 1: SELECT FILE */}
        {step === 'select' && (
          <div className="space-y-4">
            {fileError && (
              <Alert variant="error" title="Invalid File">
                {fileError}
              </Alert>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                  : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Upload className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Click to browse or drag and drop your CSV file here
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Max file size: 2 MB · Up to {MAX_CSV_ROW_LIMIT} candidates per batch
              </p>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              <div className="font-semibold text-neutral-900 dark:text-neutral-200 mb-1">
                CSV Formatting Requirements:
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Required columns: <code className="text-neutral-800 dark:text-neutral-200">name</code> and <code className="text-neutral-800 dark:text-neutral-200">email</code>.</li>
                <li>Each candidate will be sent a single-use expiring invitation link.</li>
                <li>Duplicate emails and invalid entries will be flagged before import.</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW AND VALIDATE */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-500" />
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {selectedFile?.name}
                </span>
                <span className="text-neutral-500">
                  ({(selectedFile?.size ?? 0) > 1024 ? `${Math.round((selectedFile?.size ?? 0) / 1024)} KB` : `${selectedFile?.size} bytes`})
                </span>
              </div>
              <Badge variant="default">{preview.totalRows} Total Rows</Badge>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-success-border bg-success-muted p-3 text-center">
                <div className="text-lg font-bold text-success">
                  {preview.validRows.length}
                </div>
                <div className="text-xs text-success font-medium">
                  Ready to Import
                </div>
              </div>

              <div className="rounded-lg border border-warning-border bg-warning-muted p-3 text-center">
                <div className="text-lg font-bold text-warning">
                  {preview.duplicateRows.length}
                </div>
                <div className="text-xs text-warning font-medium">
                  Duplicates (Skipped)
                </div>
              </div>

              <div className="rounded-lg border border-danger-border bg-danger-muted p-3 text-center">
                <div className="text-lg font-bold text-danger">
                  {preview.invalidRows.length}
                </div>
                <div className="text-xs text-danger font-medium">
                  Invalid (Skipped)
                </div>
              </div>
            </div>

            {/* Error / duplicate alert with export */}
            {(preview.invalidRows.length > 0 || preview.duplicateRows.length > 0) && (
              <div className="flex items-center justify-between rounded-md border border-warning-border bg-warning-muted p-3 text-xs text-warning-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {preview.invalidRows.length + preview.duplicateRows.length} rows have errors or duplicates and will be skipped (EX-11).
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadErrors([...preview.duplicateRows, ...preview.invalidRows])}
                  className="h-7 text-xs shrink-0"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Export Errors
                </Button>
              </div>
            )}

            {/* Preview table (first 8 rows) */}
            <div className="max-h-60 overflow-y-auto rounded-md border border-neutral-200 text-xs dark:border-neutral-800">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800">
                  <tr>
                    <th className="p-2 font-medium">Row</th>
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Email</th>
                    <th className="p-2 font-medium">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {preview.validRows.slice(0, 8).map((row) => (
                    <tr key={row.rowNumber} className="bg-white dark:bg-neutral-900">
                      <td className="p-2 text-neutral-500">{row.rowNumber}</td>
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 text-neutral-600 dark:text-neutral-400">{row.email}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1 text-success font-medium">
                          <Check className="h-3 w-3" /> Valid
                        </span>
                      </td>
                    </tr>
                  ))}
                  {preview.invalidRows.slice(0, 4).map((err) => (
                    <tr key={`inv-${err.rowNumber}`} className="bg-danger-muted/30">
                      <td className="p-2 text-neutral-500">{err.rowNumber}</td>
                      <td className="p-2 font-medium">{err.name || '<empty>'}</td>
                      <td className="p-2 text-neutral-600 dark:text-neutral-400">{err.email || '<empty>'}</td>
                      <td className="p-2 text-danger font-medium">{err.reason}</td>
                    </tr>
                  ))}
                  {preview.duplicateRows.slice(0, 4).map((dup) => (
                    <tr key={`dup-${dup.rowNumber}`} className="bg-warning-muted/30">
                      <td className="p-2 text-neutral-500">{dup.rowNumber}</td>
                      <td className="p-2 font-medium">{dup.name}</td>
                      <td className="p-2 text-neutral-600 dark:text-neutral-400">{dup.email}</td>
                      <td className="p-2 text-warning font-medium">{dup.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: SUMMARY */}
        {step === 'summary' && importResult && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted text-success">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Bulk Import Completed
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Candidate records have been processed and invitations dispatched.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-success-border bg-success-muted p-4 text-center">
                <div className="text-2xl font-bold text-success">
                  {importResult.created.length}
                </div>
                <div className="text-xs text-success font-medium">
                  Successfully Invited
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-2xl font-bold text-neutral-700 dark:text-neutral-300">
                  {importResult.errors.length}
                </div>
                <div className="text-xs text-neutral-500 font-medium">
                  Skipped / Errors
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <span className="text-neutral-600 dark:text-neutral-400">
                  Download the detailed error report to view reasons for skipped rows (EX-11).
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadErrors(importResult.errors)}
                  className="h-7 text-xs"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download Error CSV
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
