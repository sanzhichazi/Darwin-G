import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Prefer Dify; fallback to OpenAI if needed.
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_BASE_URL = process.env.DIFY_API_BASE_URL || "https://api.dify.ai/v1";

async function canReachDify() {
  if (!DIFY_API_KEY) {
    return false;
  }
  
  // Skip connectivity check - just assume Dify is available if we have API key
  // The actual request will handle any connectivity issues
  return true;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  let walletAddress: string | undefined;
  let conversationId: string | undefined;

  // Find the last user message and extract walletAddress and conversationId from its data
  const lastUserMessage = messages.findLast((m) => m.role === "user");
  if (lastUserMessage && (lastUserMessage as any).data) {
    const messageData = (lastUserMessage as any).data;
    if (typeof messageData.walletAddress === 'string') {
      walletAddress = messageData.walletAddress;
      // Don't delete walletAddress as it might be needed
    }
    if (typeof messageData.conversationId === 'string') {
      conversationId = messageData.conversationId;
      // Don't delete conversationId as it might be needed
    }
  }

  console.log("Received wallet address:", walletAddress);
  console.log("Received conversation ID:", conversationId);

  // Decide provider: prefer Dify; use OpenAI as fallback.
  const useDify = await canReachDify();
  
  if (useDify) {
    // Use Dify API with streaming to handle tool responses
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage?.parts?.find(p => p.type === 'text')?.text || '';
    
    try {
      const response = await fetch(`${DIFY_API_BASE_URL.replace(/\/$/, "")}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: {},
          query: query,
          response_mode: "streaming", // Use streaming to get all messages including tool responses
          user: walletAddress || "web-user",
          ...(conversationId && { conversation_id: conversationId }), // Include conversation_id if available
        })
      });

      if (!response.ok) {
        throw new Error(`Dify API error: ${response.status}`);
      }

      // Handle the streaming response from Dify
      return new Response(
        new ReadableStream({
          async start(controller) {
            const reader = response.body?.getReader();
            if (!reader) {
              controller.close();
              return;
            }

            let buffer = '';
            let messageId = `msg_${Date.now()}`;
            let hasStarted = false;
            let streamingContent = '';
            let capturedConversationId: string | undefined;

            try {
              // Send initial start sequence
              controller.enqueue(new TextEncoder().encode(`data: {"type":"start"}\n\n`));
              controller.enqueue(new TextEncoder().encode(`data: {"type":"start-step"}\n\n`));

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += new TextDecoder().decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                  if (!line.trim()) continue;
                  
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                      const parsed = JSON.parse(data);
                      
                      // Capture conversation_id from any response that contains it
                      if (parsed.conversation_id && !capturedConversationId) {
                        capturedConversationId = parsed.conversation_id;
                        console.log("Captured conversation ID from Dify:", capturedConversationId);
                      }
                      
                      // Stream message events as they come for real-time response
                      if (parsed.event === 'message' && parsed.answer) {
                        if (!hasStarted) {
                          controller.enqueue(new TextEncoder().encode(`data: {"type":"text-start","id":"${messageId}"}\n\n`));
                          hasStarted = true;
                        }
                        
                        // Stream each message chunk immediately with proper JSON escaping
                        const escapedAnswer = JSON.stringify(parsed.answer);
                        controller.enqueue(new TextEncoder().encode(`data: {"type":"text-delta","id":"${messageId}","delta":${escapedAnswer}}\n\n`));
                        streamingContent += parsed.answer;
                      }
                      
                      // Also handle workflow_finished as backup for complete response
                      else if (parsed.event === 'workflow_finished') {
                        if (parsed.data && parsed.data.outputs && parsed.data.outputs.answer) {
                          const completeResponse = parsed.data.outputs.answer;
                          
                          // If we have more content than what was streamed, send the rest
                          if (completeResponse.length > streamingContent.length) {
                            const remainingContent = completeResponse.substring(streamingContent.length);
                            if (remainingContent.trim()) {
                              if (!hasStarted) {
                                controller.enqueue(new TextEncoder().encode(`data: {"type":"text-start","id":"${messageId}"}\n\n`));
                                hasStarted = true;
                              }
                              const escapedRemaining = JSON.stringify(remainingContent);
                              controller.enqueue(new TextEncoder().encode(`data: {"type":"text-delta","id":"${messageId}","delta":${escapedRemaining}}\n\n`));
                            }
                          }
                        }
                        
                        // End the message and stream
                        if (hasStarted) {
                          controller.enqueue(new TextEncoder().encode(`data: {"type":"text-end","id":"${messageId}"}\n\n`));
                        }
                        
                        // Include conversation_id in the final message data
                        if (capturedConversationId) {
                          controller.enqueue(new TextEncoder().encode(`data: {"type":"data","data":{"conversationId":"${capturedConversationId}"}}\n\n`));
                        }
                        
                        controller.enqueue(new TextEncoder().encode(`data: {"type":"finish-step"}\n\n`));
                        controller.enqueue(new TextEncoder().encode(`data: {"type":"finish"}\n\n`));
                        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
                        
                        controller.close();
                        return;
                      }
                    } catch (e) {
                      // Skip malformed JSON
                      continue;
                    }
                  }
                }
              }
              
              // Fallback if connection ends without workflow_finished
              if (hasStarted) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"text-end","id":"${messageId}"}\n\n`));
              }
              
              // Include conversation_id in the final message data
              if (capturedConversationId) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"data","data":{"conversationId":"${capturedConversationId}"}}\n\n`));
              }
              
              controller.enqueue(new TextEncoder().encode(`data: {"type":"finish-step"}\n\n`));
              controller.enqueue(new TextEncoder().encode(`data: {"type":"finish"}\n\n`));
              controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
              
            } finally {
              reader.releaseLock();
            }
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'x-vercel-ai-ui-message-stream': 'v1',
          }
        }
      );

    } catch (error) {
      console.log('Dify API failed, falling back to OpenAI');
      // Fall through to OpenAI fallback
    }
  }

  // Fallback to OpenAI
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
