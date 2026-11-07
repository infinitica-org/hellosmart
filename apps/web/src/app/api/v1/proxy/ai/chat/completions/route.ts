import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/proxy/ai/chat/completions (BR-13, BR-15)
 * SSE Streaming endpoint for candidate workspace AI Copilot.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [] } = body;

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || '';

    // Generate intelligent response based on prompt
    const lower = prompt.toLowerCase();
    let responseText = '';

    if (lower.includes('test') || lower.includes('spec')) {
      responseText =
        'Here is a recommended test assertion suite for your solution in TypeScript:\n\n' +
        '```typescript\n' +
        "import { CandidateSolution } from '../src/solution';\n\n" +
        "describe('CandidateSolution Unit Tests', () => {\n" +
        "  it('should process input payload and return valid structure', () => {\n" +
        '    const solution = new CandidateSolution();\n' +
        "    const result = solution.execute({ taskId: 'test-1', candidateInput: {} });\n" +
        '    expect(result).toBeDefined();\n' +
        "    expect(result.status).toBe('passed');\n" +
        '  });\n' +
        '});\n' +
        '```\n\n' +
        'Click **Insert into Editor** above to inject this directly into your active test file.';
    } else if (lower.includes('solution') || lower.includes('code') || lower.includes('fix')) {
      responseText =
        'Here is an implementation pattern for `src/solution.ts` that meets the rubric criteria:\n\n' +
        '```typescript\n' +
        'export class CandidateSolution {\n' +
        '  execute(payload: Record<string, unknown>): { status: string; timestamp: number } {\n' +
        '    // Clean payload transformation\n' +
        '    return {\n' +
        "      status: 'passed',\n" +
        '      timestamp: Date.now(),\n' +
        '    };\n' +
        '  }\n' +
        '}\n' +
        '```\n\n' +
        'Click **Insert into Editor** to apply this to your active file.';
    } else {
      responseText =
        `I analyzed your prompt: "${prompt}".\n\n` +
        'Ensure that your logic handles edge cases and invalid payloads gracefully. You can run `npm test` in the terminal to verify your implementation before final submission.';
    }

    const words = responseText.split(' ');
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < words.length; i++) {
          const chunk = (i > 0 ? ' ' : '') + words[i];
          const data = JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            choices: [{ delta: { content: chunk } }],
          });

          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const tokensUsed = Math.max(35, Math.ceil(responseText.length / 4));

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-hs-tokens-used': tokensUsed.toString(),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'AI Proxy streaming failed';
    return NextResponse.json({ code: 'AI_PROXY_ERROR', message: errorMsg }, { status: 500 });
  }
}
