// 前端只调自家 /api/chat，token 留在 server/index.ts。
// 这一层只做 fetch + 类型化，不掺业务逻辑（业务逻辑放 pathPlanner.ts）。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
    reasoning_content?: string;
    tool_calls?: unknown[];
  };
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface CallLLMOptions {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

export async function callLLM(
  messages: ChatMessage[],
  options: CallLLMOptions = {}
): Promise<ChatCompletionResponse> {
  const { model = 'glm-5', temperature, signal } = options;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, temperature }),
    signal,
  });

  let data: ChatCompletionResponse;
  try {
    data = await res.json();
  } catch {
    throw new Error(`LLM 响应非 JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data.error || `LLM 调用失败 (HTTP ${res.status})`);
  }

  return data;
}

/** 拿第一个 choice 的 content。多数情况就用这个就够了。 */
export function getContent(resp: ChatCompletionResponse): string {
  return resp.choices?.[0]?.message?.content ?? '';
}

export function getReasoning(resp: ChatCompletionResponse): string | undefined {
  return resp.choices?.[0]?.message?.reasoning_content;
}
