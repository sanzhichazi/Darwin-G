import { openai, createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

// 允许流式响应最长持续 30 秒
export const maxDuration = 30;

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_BASE_URL = process.env.DIFY_API_BASE_URL || "https://api.dify.ai/v1";

// 在尝试使用 Dify API 之前，先检查其是否可达
async function canReachDify() {
  if (!DIFY_API_KEY) return false;
  try {
    // 使用一个较短的超时时间，以避免在无响应的环境中长时间等待
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${DIFY_API_BASE_URL.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${DIFY_API_KEY}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // 网络错误或超时会在这里被捕获
    return false;
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 根据 Dify 的可达性来决定使用哪个服务提供商
  const useDify = await canReachDify();
  
  console.log(useDify ? "正在使用 Dify API" : "Dify 无法访问，回退到 OpenAI");

  const provider = useDify
    ? createOpenAI({
        apiKey: DIFY_API_KEY as string,
        baseURL: DIFY_API_BASE_URL,
      })
    : openai; // 默认的 OpenAI 实例 (会使用 OPENAI_API_KEY)

  const result = streamText({
    model: provider("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
  });

  // 返回与 Generative UI Chatbot 兼容的 UI 消息流
  return result.toUIMessageStreamResponse();
}
