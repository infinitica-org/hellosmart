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
      templateModes,
      candidateModes,
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
      const oldMode = templateModes?.get(relPath) ?? 0o100644;
      const newMode = candidateModes?.get(relPath) ?? 0o100644;
      const oldModeStr = (oldMode & 0o777) === 0o755 ? '100755' : '100644';
      const newModeStr = (newMode & 0o777) === 0o755 ? '100755' : '100644';

      // 1. Unchanged file
      if (templateBuf && candidateBuf && templateBuf.equals(candidateBuf)) {
        if (oldModeStr !== newModeStr) {
          filesChanged++;
          const modeHeader = `diff --git a/${relPath} b/${relPath}\nold mode ${oldModeStr}\nnew mode ${newModeStr}\n`;
          patchParts.push(modeHeader);
          currentPatchBytes += Buffer.byteLength(modeHeader, 'utf8');
        }
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
          binaryHeader += `new file mode ${newModeStr}\n`;
        } else if (!candidateBuf) {
          binaryHeader += `deleted file mode ${oldModeStr}\n`;
        } else if (oldModeStr !== newModeStr) {
          binaryHeader += `old mode ${oldModeStr}\nnew mode ${newModeStr}\n`;
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
        filePatch += `new file mode ${newModeStr}\n`;
        filePatch += `--- /dev/null\n`;
        filePatch += `+++ b/${relPath}\n`;
      } else if (!candidateBuf) {
        filePatch += `deleted file mode ${oldModeStr}\n`;
        filePatch += `--- a/${relPath}\n`;
        filePatch += `+++ /dev/null\n`;
      } else {
        if (oldModeStr !== newModeStr) {
          filePatch += `old mode ${oldModeStr}\n`;
          filePatch += `new mode ${newModeStr}\n`;
        }
        filePatch += `--- a/${relPath}\n`;
        filePatch += `+++ b/${relPath}\n`;
      }

      for (const hunk of patchObj.hunks) {
        const oldHunk = hunk.oldLines === 0 ? '0,0' : `${hunk.oldStart},${hunk.oldLines}`;
        const newHunk = hunk.newLines === 0 ? '0,0' : `${hunk.newStart},${hunk.newLines}`;
        filePatch += `@@ -${oldHunk} +${newHunk} @@\n`;
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
