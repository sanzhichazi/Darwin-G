import { openai, createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Prefer OpenAI for reliability; try Dify only if reachable.
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_BASE_URL = process.env.DIFY_API_BASE_URL || "https://api.dify.ai/v1";

async function canReachDify() {
  if (!DIFY_API_KEY) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${DIFY_API_BASE_URL.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${DIFY_API_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Decide provider: default to OpenAI; use Dify only if the endpoint is reachable.
  const useDify = await canReachDify();
  const provider = useDify
    ? createOpenAI({
        apiKey: DIFY_API_KEY as string,
        baseURL: DIFY_API_BASE_URL,
      })
    : openai;

  const result = streamText({
    model: provider("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
  });

  // Return UI message stream compatible with Generative UI Chatbot.
  return result.toUIMessageStreamResponse();
}
