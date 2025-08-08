"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Sparkles } from 'lucide-react';
import {
  MessageBubble,
  AttachmentChips,
  type AttachmentPreview,
} from "@/components/chat-bubbles";
import { cn } from "@/lib/utils";
import { STORAGE_KEY } from "@/components/wallet-connect";
import { Sidebar } from "@/components/sidebar"; // Import the new Sidebar component

const BRAND_COLOR = "rgb(249, 217, 247)";

type DragState = "idle" | "over";

export default function Page() {
  const {
    messages,
    sendMessage,
    addToolResult,
    // Automatically send after tool calls complete (Generative UI pattern)
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Example client-side tool handler (optional):
    async onToolCall({ toolCall }) {
      // You can run simple client-side tools. Here we just demo a stub handler.
      if (toolCall.toolName === "getLocation") {
        // Return a random demo city:
        const cities = ["New York", "Los Angeles", "Chicago", "San Francisco"];
        addToolResult({
          tool: "getLocation",
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        });
      }
    },
  });

  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [files, setFiles] = React.useState<AttachmentPreview[]>([]);
  const [drag, setDrag] = React.useState<DragState>("idle");
  const [activeMainTab, setActiveMainTab] = React.useState<'chat' | 'products' | 'marketing'>('chat'); // State for active main content tab

  const messagesRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const onFilesSelected = React.useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const newItems: AttachmentPreview[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)!;
      const id = `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID()}`;
      const item: AttachmentPreview = {
        id,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
      };

      if (f.type.startsWith("image/")) {
        item.url = URL.createObjectURL(f);
      } else if (
        f.type.startsWith("text/") ||
        f.type.includes("json") ||
        f.type.includes("csv")
      ) {
        const text = await f.text();
        item.textSample = text.slice(0, 1000);
      }

      newItems.push(item);
    }
    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const onDrop = React.useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDrag("idle");
      const dt = e.dataTransfer;
      await onFilesSelected(dt.files);
    },
    [onFilesSelected]
  );

  const onSend = React.useCallback(async () => {
    if (!input.trim() && files.length === 0) return;

    // Include a simple attachment summary into the user message:
    const attachmentSummary =
      files.length > 0
        ? "\n\n[Attachments]\n" +
          files
            .map((f, idx) => {
              const base = `${idx + 1}. ${f.name} (${Math.ceil(f.size / 1024)} KB, ${
                f.type || "unknown"
              })`;
              const snippet = f.textSample ? `\n---\n${f.textSample}\n---\n` : "";
              return base + (snippet ? `\n${snippet}` : "");
            })
            .join("\n")
        : "";

    // Get the current wallet address from localStorage
    const currentWalletAddress = localStorage.getItem(STORAGE_KEY);

    setSending(true);
    try {
      // Generative UI Chatbot expects structured parts. The simplest is a single text part:
      await sendMessage({
        parts: [{ type: "text", text: input + attachmentSummary }],
        // Add walletAddress to the data property of the user message
        data: { walletAddress: currentWalletAddress },
      });
      setInput("");
      files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      setFiles([]);
    } finally {
      setSending(false);
    }
  }, [files, input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <main className="min-h-dvh bg-neutral-50 flex flex-col">
      <header className="w-full border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center font-semibold"
              style={{ backgroundColor: BRAND_COLOR, color: "#111" }}
              aria-label="Darwin logo"
              title="Darwin"
            >
              {"D"}
            </div>
            <div className="text-lg font-semibold tracking-tight">{"Darwin"}</div>
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: "rgba(249, 217, 247, 0.35)", color: "#7a2c69" }}
            >
              <Sparkles className="h-3 w-3" />
              {"AI Chat"}
            </span>
          </div>
          {/* WalletConnectButton moved to Sidebar */}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden"> {/* New flex container for sidebar and main content */}
        <Sidebar onSelectTab={setActiveMainTab} activeTab={activeMainTab} /> {/* Render the new Sidebar component */}

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {activeMainTab === 'chat' && (
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 grid grid-rows-[1fr_auto] gap-4">
              <div className="row-start-1 overflow-hidden">
                <div
                  ref={messagesRef}
                  className="h-full overflow-y-auto p-4 sm:p-6"
                >
                  {/* Empty-state like ChatGPT: input centered until first message */}
                  {messages.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="max-w-3xl w-full">
                        <div className="text-center mb-6">
                          <h1 className="text-2xl font-semibold">{"Welcome to Darwin"}</h1>
                          <p className="text-sm text-muted-foreground mt-1">
                            {'A Multi-Agent AI System for Autonomous E-commerce Operations.'}
                            <br />
                            {'Drag & drop product files here. Press Ctrl/⌘ + Enter to send.'}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "rounded-xl border relative",
                            drag === "over" ? "border-emerald-500 bg-emerald-50" : "border-muted"
                          )}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDrag("over");
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDrag("over");
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setDrag("idle");
                          }}
                          onDrop={onDrop}
                        >
                          <div className="p-4 sm:p-5">
                            <Textarea
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder="Describe your ideal shop or business plan, upload your product files—Darwin will take it from there."
                              className="min-h-[120px] resize-y"
                            />
                            <div className="flex items-center justify-between mt-3">
                              <Button
                                variant="ghost"
                                className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer px-2 py-2 rounded-md hover:bg-muted" // Keep original styling
                                onClick={() => document.getElementById('file-input-top')?.click()} // Trigger file input click
                              >
                                <input
                                  id="file-input-top" // Add unique ID for this input
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => onFilesSelected(e.target.files)}
                                />
                                <Paperclip className="h-4 w-4" />
                                {"Add attachments"}
                              </Button>
                              <Button
                                onClick={onSend}
                                disabled={sending || (!input.trim() && files.length === 0)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {sending ? "Sending…" : "Send"}
                              </Button>
                            </div>
                            <AttachmentChips
                              items={files}
                              onRemove={(id) =>
                                setFiles((prev) => prev.filter((f) => f.id !== id))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Generative UI Chatbot rendering of message parts:
                    <div className="flex flex-col gap-4">
                      {messages.map((m) => (
                        <MessageBubble key={m.id} role={m.role as any}>
                          {m.parts.map((part, index) => {
                            switch (part.type) {
                              case "text":
                                return <div key={index}>{part.text}</div>;
                              case "reasoning":
                                return <pre key={index}>{part.text}</pre>;
                              // Example typed tool part rendering (will only appear if server provides tools)
                              case "tool-askForConfirmation": {
                                const callId = part.toolCallId;
                                switch (part.state) {
                                  case "input-streaming":
                                    return (
                                      <div key={callId}>Loading confirmation request...</div>
                                    );
                                  case "input-available":
                                    return (
                                      <div key={callId}>
                                        {part.input.message}
                                        <div className="mt-2 flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() =>
                                              addToolResult({
                                                tool: "askForConfirmation",
                                                toolCallId: callId,
                                                output: "Yes, confirmed.",
                                              })
                                            }
                                          >
                                            Yes
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              addToolResult({
                                                tool: "askForConfirmation",
                                                toolCallId: callId,
                                                output: "No, denied",
                                              })
                                            }
                                          >
                                            No
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  case "output-available":
                                    return (
                                      <div key={callId}>
                                        Confirmation result: {String(part.output)}
                                      </div>
                                    );
                                  case "output-error":
                                    return <div key={callId}>Error: {part.errorText}</div>;
                                }
                                break;
                              }
                              case "tool-getLocation": {
                                const callId = part.toolCallId;
                                switch (part.state) {
                                  case "input-streaming":
                                    return <div key={callId}>Preparing location request...</div>;
                                  case "input-available":
                                    return <div key={callId}>Getting location...</div>;
                                  case "output-available":
                                    return <div key={callId}>Location: {part.output}</div>;
                                  case "output-error":
                                    return <div key={callId}>Error: {part.errorText}</div>;
                                }
                                break;
                              }
                              default:
                                return null;
                            }
                          })}
                        </MessageBubble>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {messages.length > 0 && (
                <div
                  className={cn("p-3 sm:p-4", "border-t bg-background", "relative")}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDrag("over");
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag("over");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDrag("idle");
                  }}
                  onDrop={onDrop}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message or drop files here…"
                        className="min-h-[56px] max-h-[160px] resize-y"
                      />
                      <Button
                        variant="ghost"
                        className="shrink-0 h-10 px-2 sm:px-4" // Ensure consistent height and padding
                        onClick={() => document.getElementById('file-input-bottom')?.click()} // Trigger file input click
                      >
                        <input
                          id="file-input-bottom" // Add unique ID for this input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => onFilesSelected(e.target.files)}
                        />
                        <Paperclip className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">{"Add attachments"}</span> {/* Add ml-2 for spacing */}
                      </Button>
                      <Button
                        onClick={onSend}
                        disabled={sending || (!input.trim() && files.length === 0)}
                        className="shrink-0 h-10" // Ensure consistent height
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <AttachmentChips
                      items={files}
                      onRemove={(id) =>
                        setFiles((prev) => prev.filter((f) => f.id !== id))
                      }
                    />
                    {drag === "over" ? (
                      <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50/50" />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMainTab === 'products' && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Product Management</h2>
              <p className="text-muted-foreground mb-4">
                Upload your product list, and Darwin will automatically generate optimized listings and publish them across supported e-commerce platforms.
              </p>
              <div className="border rounded-lg p-4 bg-white flex-1 flex items-center justify-center text-center text-muted-foreground">
                <p>Product listing and management features will appear here.</p>
              </div>
            </div>
          )}

          {activeMainTab === 'marketing' && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Marketing & Promotion</h2>
              <p className="text-muted-foreground mb-4">
                Darwin designs and executes data-driven marketing strategies, auto-generates engaging promotional content, and builds content commerce funnels.
              </p>
              <div className="border rounded-lg p-4 bg-white flex-1 flex items-center justify-center text-center text-muted-foreground">
                <p>Marketing campaign and social media features will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full border-t">
        <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>{"© "} {new Date().getFullYear()} {" Darwin"}</span>
          <span>{"AI powered by OpenAI. Set OPENAI_API_KEY to enable responses."}</span>
        </div>
      </footer>
    </main>
  );
}
