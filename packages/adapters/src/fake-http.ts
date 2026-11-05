import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import type { SafeHttp } from './index.js';

export interface MockHttpResponse {
  status: number;
  body: Buffer;
}

export class FakeSafeHttp implements SafeHttp {
  private mockResponses = new Map<string, MockHttpResponse>();

  /**
   * Register a simulated response for testing
   */
  mockResponse(url: string, response: { status: number; body: Buffer | string }): void {
    const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body, 'utf8');
    this.mockResponses.set(url, { status: response.status, body });
  }

  /**
   * SSRF-safe HTTP GET simulator. Blocks private IP spaces unless host is in allowHosts.
   */
  async get(
    url: string,
    opts?: { allowHosts?: string[]; timeoutMs?: number; maxBytes?: number },
  ): Promise<{ status: number; body: Buffer }> {
    const parsed = new URL(url);

    // SSRF Check
    const hostname = parsed.hostname;
    const isAllowed = opts?.allowHosts?.includes(hostname);

    if (!isAllowed) {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '169.254.169.254' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
      ) {
        throw new Error(`SSRF blocked request to private/internal host: ${hostname}`);
      }
    }

    const mocked = this.mockResponses.get(url);
    if (mocked) {
      return mocked;
    }

    // Default simulated response
    return {
      status: 200,
      body: Buffer.from(JSON.stringify({ ok: true, url, host: hostname }), 'utf8'),
    };
  }

  clear(): void {
    this.mockResponses.clear();
  }
}
