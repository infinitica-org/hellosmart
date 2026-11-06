import { Injectable } from '@nestjs/common';
import * as diff from 'diff';
import type {
  GeneratePatchParams,
  PatchGeneratorPort,
  PatchResult,
} from './ports/patch-generator.port.js';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB per file
export const DEFAULT_MAX_PATCH_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB total patch
export const DEFAULT_DIFF_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Checks whether a buffer contains binary data (e.g. NUL bytes).
 */
export function isBinaryBuffer(buf: Buffer): boolean {
  // Check the first 8000 bytes for NUL byte
  const checkLen = Math.min(buf.length, 8000);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

@Injectable()
export class GitDiffHelper implements PatchGeneratorPort {
  async generatePatch(params: GeneratePatchParams): Promise<PatchResult> {
    const {
      templateFiles,
      candidateFiles,
      maxPatchSizeBytes = DEFAULT_MAX_PATCH_SIZE_BYTES,
      maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
      timeoutMs = DEFAULT_DIFF_TIMEOUT_MS,
    } = params;

    if (templateFiles === null) {
      return {
        patchText: '',
        patchStatus: 'unavailable',
        filesChanged: 0,
        additions: 0,
        deletions: 0,
        isPartial: true,
        reason: 'Template base tree unavailable for diff generation',
      };
    }

    const startTime = Date.now();
    const patchParts: string[] = [];
    let currentPatchBytes = 0;
    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;
    let isPartial = false;
    const partialReasons: string[] = [];

    // Collect all unique relative paths, sorted lexicographically
    const allPaths = new Set<string>();
    for (const p of templateFiles.keys()) allPaths.add(p);
    for (const p of candidateFiles.keys()) allPaths.add(p);
    const sortedPaths = Array.from(allPaths).sort((a, b) => a.localeCompare(b));

    for (const relPath of sortedPaths) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        isPartial = true;
        partialReasons.push(`Diff generation timed out after ${timeoutMs}ms`);
        break;
      }

      // Check total patch size
      if (currentPatchBytes >= maxPatchSizeBytes) {
        isPartial = true;
        partialReasons.push(`Total patch size exceeded limit of ${maxPatchSizeBytes} bytes`);
        break;
      }

      const templateBuf = templateFiles.get(relPath);
      const candidateBuf = candidateFiles.get(relPath);

      // 1. Unchanged file
      if (templateBuf && candidateBuf && templateBuf.equals(candidateBuf)) {
        continue;
      }

      filesChanged++;

      // Check per-file size limit
      const tSize = templateBuf?.length ?? 0;
      const cSize = candidateBuf?.length ?? 0;
      if (tSize > maxFileSizeBytes || cSize > maxFileSizeBytes) {
        isPartial = true;
        partialReasons.push(
          `File '${relPath}' exceeds per-file size limit of ${maxFileSizeBytes} bytes`,
        );
        const header = `diff --git a/${relPath} b/${relPath}\n[diff too large, file replaced: omitted from patch]\n`;
        patchParts.push(header);
        currentPatchBytes += Buffer.byteLength(header, 'utf8');
        continue;
      }

      // 2. Binary files
      const isTemplateBinary = templateBuf ? isBinaryBuffer(templateBuf) : false;
      const isCandidateBinary = candidateBuf ? isBinaryBuffer(candidateBuf) : false;

      if (isTemplateBinary || isCandidateBinary) {
        let binaryHeader = `diff --git a/${relPath} b/${relPath}\n`;
        if (!templateBuf) {
          binaryHeader += `new file mode 100644\n`;
        } else if (!candidateBuf) {
          binaryHeader += `deleted file mode 100644\n`;
        }
        binaryHeader += `Binary files differ\n`;
        patchParts.push(binaryHeader);
        currentPatchBytes += Buffer.byteLength(binaryHeader, 'utf8');
        continue;
      }

      // 3. Text files
      const oldStr = templateBuf ? templateBuf.toString('utf8') : '';
      const newStr = candidateBuf ? candidateBuf.toString('utf8') : '';

      const patchObj = diff.structuredPatch(
        `a/${relPath}`,
        `b/${relPath}`,
        oldStr,
        newStr,
        '',
        '',
        { context: 3 },
      );

      let filePatch = `diff --git a/${relPath} b/${relPath}\n`;
      if (!templateBuf) {
        filePatch += `new file mode 100644\n`;
        filePatch += `--- /dev/null\n`;
        filePatch += `+++ b/${relPath}\n`;
      } else if (!candidateBuf) {
        filePatch += `deleted file mode 100644\n`;
        filePatch += `--- a/${relPath}\n`;
        filePatch += `+++ /dev/null\n`;
      } else {
        filePatch += `--- a/${relPath}\n`;
        filePatch += `+++ b/${relPath}\n`;
      }

      for (const hunk of patchObj.hunks) {
        filePatch += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
        for (const line of hunk.lines) {
          filePatch += `${line}\n`;
          if (line.startsWith('+')) additions++;
          else if (line.startsWith('-')) deletions++;
        }
      }

      patchParts.push(filePatch);
      currentPatchBytes += Buffer.byteLength(filePatch, 'utf8');
    }

    const fullPatchText = patchParts.join('');

    return {
      patchText: fullPatchText,
      patchStatus: isPartial ? 'truncated' : 'complete',
      filesChanged,
      additions,
      deletions,
      isPartial,
      reason: partialReasons.length > 0 ? partialReasons.join('; ') : undefined,
    };
  }
}
