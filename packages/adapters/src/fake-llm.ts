export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMClient {
  complete(prompt: string, opts?: LLMCompletionOptions): Promise<{ text: string; tokensIn: number; tokensOut: number }>;
  chat(messages: LLMMessage[], opts?: LLMCompletionOptions): Promise<{ message: LLMMessage; tokensIn: number; tokensOut: number }>;
}

export class FakeLLMClient implements LLMClient {
  private cannedResponses = new Map<string, string>();
  private defaultResponse: string;

  constructor(defaultResponse: string = 'Simulated LLM response for testing.') {
    this.defaultResponse = defaultResponse;
  }

  setResponse(promptSubstr: string, response: string): void {
    this.cannedResponses.set(promptSubstr, response);
  }

  async complete(
    prompt: string,
    opts?: LLMCompletionOptions,
  ): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    for (const [key, val] of this.cannedResponses) {
      if (prompt.includes(key)) {
        return { text: val, tokensIn: Math.ceil(prompt.length / 4), tokensOut: Math.ceil(val.length / 4) };
      }
    }
    return {
      text: `[${opts?.model || 'fake-model'}] ${this.defaultResponse}`,
      tokensIn: Math.ceil(prompt.length / 4),
      tokensOut: Math.ceil(this.defaultResponse.length / 4),
    };
  }

  async chat(
    messages: LLMMessage[],
    opts?: LLMCompletionOptions,
  ): Promise<{ message: LLMMessage; tokensIn: number; tokensOut: number }> {
    const lastUser = messages.filter((m) => m.role === 'user').pop();
    const prompt = lastUser ? lastUser.content : '';
    const res = await this.complete(prompt, opts);
    return {
      message: { role: 'assistant', content: res.text },
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
    };
  }

  clear(): void {
    this.cannedResponses.clear();
  }
}
