"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Send, Settings } from "lucide-react"
import { MessageBubble, AttachmentChips, type AttachmentPreview } from "@/components/chat-bubbles"
import { cn } from "@/lib/utils"
import { STORAGE_KEY } from "@/components/wallet-connect"
import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { Response } from "@/components/ai-elements/response"

const BRAND_COLOR = "rgb(249, 217, 247)"

type DragState = "idle" | "over"

export default function Page() {
  const [activeMainTab, setActiveMainTab] = React.useState<
    "dashboard" | "chat" | "products" | "marketing" | "crm" | "risk" | "stores"
  >("dashboard")

  const [marketingTab, setMarketingTab] = React.useState<"twitter" | "email" | "settings">("twitter")

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
        const cities = ["New York", "Los Angeles", "Chicago", "San Francisco"]
        addToolResult({
          tool: "getLocation",
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        })
      }
    },
  })

  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [files, setFiles] = React.useState<AttachmentPreview[]>([])
  const [drag, setDrag] = React.useState<DragState>("idle")

  const messagesRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  const onFilesSelected = React.useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const newItems: AttachmentPreview[] = []
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)!
      const id = `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID()}`
      const item: AttachmentPreview = {
        id,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
      }

      if (f.type.startsWith("image/")) {
        item.url = URL.createObjectURL(f)
      } else if (f.type.startsWith("text/") || f.type.includes("json") || f.type.includes("csv")) {
        const text = await f.text()
        item.textSample = text.slice(0, 1000)
      }

      newItems.push(item)
    }
    setFiles((prev) => [...prev, ...newItems])
  }, [])

  const onDrop = React.useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDrag("idle")
      const dt = e.dataTransfer
      await onFilesSelected(dt.files)
    },
    [onFilesSelected],
  )

  const onSend = React.useCallback(async () => {
    if (!input.trim() && files.length === 0) return

    // Include a simple attachment summary into the user message:
    const attachmentSummary =
      files.length > 0
        ? "\n\n[Attachments]\n" +
          files
            .map((f, idx) => {
              const base = `${idx + 1}. ${f.name} (${Math.ceil(f.size / 1024)} KB, ${f.type || "unknown"})`
              const snippet = f.textSample ? `\n---\n${f.textSample}\n---\n` : ""
              return base + (snippet ? `\n${snippet}` : "")
            })
            .join("\n")
        : ""

    // Get the current wallet address from localStorage
    const currentWalletAddress = localStorage.getItem(STORAGE_KEY)

    setSending(true)
    try {
      // Generative UI Chatbot expects structured parts. The simplest is a single text part:
      await sendMessage({
        parts: [{ type: "text", text: input + attachmentSummary }],
        // Add walletAddress to the data property of the user message
        data: { walletAddress: currentWalletAddress },
      })
      setInput("")
      files.forEach((f) => f.url && URL.revokeObjectURL(f.url))
      setFiles([])
    } finally {
      setSending(false)
    }
  }, [files, input, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <main className="min-h-dvh bg-neutral-50 flex flex-col">
      <header className="w-full border-b"></header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar onSelectTab={setActiveMainTab} activeTab={activeMainTab} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {activeMainTab === "dashboard" && (
            <div className="flex-1 flex flex-col">
              <Dashboard />
            </div>
          )}

          {activeMainTab === "chat" && (
            <div className="flex-1 flex flex-col">
              {/* Chat content */}
              <div className="flex-1 mx-auto w-full max-w-5xl grid grid-rows-[1fr_auto] gap-4 px-0">
                <div className="row-start-1 overflow-hidden">
                  <div ref={messagesRef} className="h-full overflow-y-auto p-4 sm:p-6">
                    {/* Empty-state like ChatGPT: input centered until first message */}
                    {messages.length === 0 ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="max-w-3xl w-full">
                          <div className="text-center mb-6">
                            <h1 className="text-2xl font-semibold">{"Agent Chat Center"}</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                              {"Real-time conversation with Agents. Choose single or multi-agent interactions."}
                              <br />
                              {"Support task instructions and feedback viewing. Drag & drop files here to start."}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "rounded-xl border relative",
                              drag === "over" ? "border-emerald-500 bg-emerald-50" : "border-muted",
                            )}
                            onDragEnter={(e) => {
                              e.preventDefault()
                              setDrag("over")
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              setDrag("over")
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault()
                              setDrag("idle")
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
                                  className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer px-2 py-2 rounded-md hover:bg-muted"
                                  onClick={() => document.getElementById("file-input-top")?.click()}
                                >
                                  <input
                                    id="file-input-top"
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => onFilesSelected(e.target.files)}
                                  />
                                  <Paperclip className="h-4 w-4" />
                                  {"Add attachments"}
                                </Button>
                                <Button onClick={onSend} disabled={sending || (!input.trim() && files.length === 0)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  {sending ? "Sending…" : "Send"}
                                </Button>
                              </div>
                              <AttachmentChips
                                items={files}
                                onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
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
                                  return <Response key={index}>{part.text}</Response>
                                case "reasoning":
                                  return <pre key={index}>{part.text}</pre>
                                // Example typed tool part rendering (will only appear if server provides tools)
                                case "tool-askForConfirmation": {
                                  const callId = part.toolCallId
                                  switch (part.state) {
                                    case "input-streaming":
                                      return <div key={callId}>Loading confirmation request...</div>
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
                                                  output: "No, denied.",
                                                })
                                              }
                                            >
                                              No
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    case "output-available":
                                      return <div key={callId}>Confirmation result: {String(part.output)}</div>
                                    case "output-error":
                                      return <div key={callId}>Error: {part.errorText}</div>
                                  }
                                  break
                                }
                                case "tool-getLocation": {
                                  const callId = part.toolCallId
                                  switch (part.state) {
                                    case "input-streaming":
                                      return <div key={callId}>Preparing location request...</div>
                                    case "input-available":
                                      return <div key={callId}>Getting location...</div>
                                    case "output-available":
                                      return <div key={callId}>Location: {part.output}</div>
                                    case "output-error":
                                      return <div key={callId}>Error: {part.errorText}</div>
                                  }
                                  break
                                }
                                default:
                                  return null
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
                    className={cn("p-3 sm:p-4 border-b mx-4 border-l border-r", "border-t bg-background", "relative")}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDrag("over")
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDrag("over")
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDrag("idle")
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
                          className="shrink-0 h-10 px-2 sm:px-4"
                          onClick={() => document.getElementById("file-input-bottom")?.click()}
                        >
                          <input
                            id="file-input-bottom"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => onFilesSelected(e.target.files)}
                          />
                          <Paperclip className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">{"Add attachments"}</span>
                        </Button>
                        <Button
                          onClick={onSend}
                          disabled={sending || (!input.trim() && files.length === 0)}
                          className="shrink-0 h-10"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <AttachmentChips
                        items={files}
                        onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
                      />
                      {drag === "over" ? (
                        <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50/50" />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMainTab === "products" && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Product Management</h2>
              <p className="text-muted-foreground mb-4">
                Display all products listed by Agents, including product sources, inventory status, logistics progress
                and quantities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Total Products</h3>
                  <p className="text-2xl font-bold text-emerald-600">1,234</p>
                  <p className="text-sm text-muted-foreground">+56 this month</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Inventory Status</h3>
                  <p className="text-2xl font-bold text-blue-600">89%</p>
                  <p className="text-sm text-muted-foreground">Products in stock</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Logistics Progress</h3>
                  <p className="text-2xl font-bold text-orange-600">156</p>
                  <p className="text-sm text-muted-foreground">Pending shipments</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white flex-1">
                <h3 className="font-medium mb-4">Product List</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Smart Phone Case</h4>
                      <p className="text-sm text-muted-foreground">Source: Agent Discovery | Stock: 500 units</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Normal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Wireless Bluetooth Earphones</h4>
                      <p className="text-sm text-muted-foreground">Source: User Listed | Stock: 120 units</p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Low Stock</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Portable Power Bank</h4>
                      <p className="text-sm text-muted-foreground">Source: Agent Recommendation | Stock: 300 units</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Normal</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMainTab === "marketing" && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Header with Quick Actions */}
              <div className="border-b bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">Marketing Automation Center</h2>
                    <p className="text-muted-foreground">
                      AI-powered marketing campaigns across social media and email channels
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Campaign Settings
                    </Button>
                    <Button size="sm">Create Campaign</Button>
                  </div>
                </div>

                {/* Real-time Performance Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded-lg bg-gradient-to-r from-purple-50 to-purple-100">
                    <p className="text-2xl font-bold text-purple-600">24</p>
                    <p className="text-sm text-muted-foreground">Posts Today</p>
                    <p className="text-xs text-green-600">+12% vs yesterday</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-blue-100">
                    <p className="text-2xl font-bold text-blue-600">1,247</p>
                    <p className="text-sm text-muted-foreground">Emails Sent</p>
                    <p className="text-xs text-green-600">24.3% open rate</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-gradient-to-r from-green-50 to-green-100">
                    <p className="text-2xl font-bold text-green-600">4.8%</p>
                    <p className="text-sm text-muted-foreground">Engagement Rate</p>
                    <p className="text-xs text-green-600">+0.7% this week</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-gradient-to-r from-orange-50 to-orange-100">
                    <p className="text-2xl font-bold text-orange-600">$2,847</p>
                    <p className="text-sm text-muted-foreground">Revenue Generated</p>
                    <p className="text-xs text-green-600">3.2% conversion</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 mx-auto w-full max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Social Media Marketing */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Social Media</h3>
                        <Button variant="outline" size="sm">
                          View All Posts
                        </Button>
                      </div>

                      {/* Platform Status */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium">Twitter</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">8 posts</p>
                            <p className="text-xs text-muted-foreground">47 engagements</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                            <span className="text-sm font-medium">Instagram</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">6 posts</p>
                            <p className="text-xs text-muted-foreground">89 engagements</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded bg-red-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-sm font-medium">Facebook</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">Disconnected</p>
                            <p className="text-xs text-muted-foreground">Needs reconnection</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Posts Preview */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Latest Auto Posts</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          <div className="p-2 bg-gray-50 rounded text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-blue-600">Twitter</span>
                              <span className="text-muted-foreground">2m ago</span>
                            </div>
                            <p className="text-gray-700">🚀 New Smart Phone Case with military-grade protection...</p>
                          </div>
                          <div className="p-2 bg-gray-50 rounded text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-pink-600">Instagram</span>
                              <span className="text-muted-foreground">15m ago</span>
                            </div>
                            <p className="text-gray-700">✨ Wireless freedom with premium Bluetooth earphones...</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Marketing Strategies */}
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Active Strategies</h3>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg bg-green-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Product Launch Campaign</h4>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Auto-post new products with 20% discount promotion
                          </p>
                          <div className="flex justify-between text-xs">
                            <span>Target: New customers</span>
                            <span className="text-green-600">156 conversions</span>
                          </div>
                        </div>
                        <div className="p-3 border rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Engagement Boost</h4>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Active</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Daily interactive content to increase follower engagement
                          </p>
                          <div className="flex justify-between text-xs">
                            <span>Target: All followers</span>
                            <span className="text-blue-600">4.8% avg engagement</span>
                          </div>
                        </div>
                        <div className="p-3 border rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Seasonal Promotion</h4>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">Scheduled</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">Holiday season campaign starting Dec 1st</p>
                          <div className="flex justify-between text-xs">
                            <span>Target: High-value customers</span>
                            <span className="text-gray-600">Starts in 15 days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column - Email Marketing */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Email Marketing</h3>
                        <Button variant="outline" size="sm">
                          View Campaigns
                        </Button>
                      </div>

                      {/* Email Performance */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center p-3 border rounded bg-blue-50">
                          <p className="text-lg font-bold text-blue-600">24.3%</p>
                          <p className="text-xs text-muted-foreground">Open Rate</p>
                        </div>
                        <div className="text-center p-3 border rounded bg-green-50">
                          <p className="text-lg font-bold text-green-600">5.8%</p>
                          <p className="text-xs text-muted-foreground">Click Rate</p>
                        </div>
                      </div>

                      {/* Email Campaign Types */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">Welcome Series</p>
                            <p className="text-xs text-muted-foreground">New subscriber onboarding</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">45.2%</p>
                            <p className="text-xs text-muted-foreground">open rate</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">Cart Recovery</p>
                            <p className="text-xs text-muted-foreground">Abandoned cart reminders</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-orange-600">12.4%</p>
                            <p className="text-xs text-muted-foreground">recovery rate</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">Product Updates</p>
                            <p className="text-xs text-muted-foreground">New arrivals & restocks</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-blue-600">18.7%</p>
                            <p className="text-xs text-muted-foreground">click rate</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Email Campaigns */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Recent Campaigns</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          <div className="p-2 bg-blue-50 rounded text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">High-Value Customers</span>
                              <span className="text-muted-foreground">30m ago</span>
                            </div>
                            <p className="text-gray-700 mb-1">Exclusive Early Access - New Tech Collection</p>
                            <p className="text-muted-foreground">1,247 sent • 24.3% opened</p>
                          </div>
                          <div className="p-2 bg-green-50 rounded text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">Cart Abandoners</span>
                              <span className="text-muted-foreground">2h ago</span>
                            </div>
                            <p className="text-gray-700 mb-1">Don't Miss Out - Complete Your Purchase</p>
                            <p className="text-muted-foreground">456 sent • 18.7% opened</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Strategies */}
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Email Strategies</h3>
                        <Button variant="outline" size="sm">
                          Create New
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg bg-purple-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Customer Lifecycle</h4>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Active</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Automated emails based on customer journey stage
                          </p>
                          <div className="flex justify-between text-xs">
                            <span>7-email sequence</span>
                            <span className="text-purple-600">89 active subscribers</span>
                          </div>
                        </div>
                        <div className="p-3 border rounded-lg bg-orange-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Win-Back Campaign</h4>
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Active</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Re-engage inactive customers with special offers
                          </p>
                          <div className="flex justify-between text-xs">
                            <span>3-email sequence</span>
                            <span className="text-orange-600">234 targeted customers</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Analytics & Settings */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Performance Analytics */}
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Performance Analytics</h3>
                        <Button variant="outline" size="sm">
                          Full Report
                        </Button>
                      </div>

                      {/* Weekly Performance */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Social Media Reach</span>
                            <span className="text-sm text-green-600">+18%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: "78%" }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">12.4K impressions this week</p>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Email Engagement</span>
                            <span className="text-sm text-green-600">+12%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: "65%" }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">4.8% average engagement rate</p>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Conversion Rate</span>
                            <span className="text-sm text-green-600">+5%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: "32%" }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">3.2% from marketing campaigns</p>
                        </div>
                      </div>

                      {/* Top Performing Content */}
                      <div className="mt-6">
                        <h4 className="text-sm font-medium mb-3">Top Performing Content</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span className="text-xs">Smart Phone Case Launch</span>
                            <span className="text-xs font-medium text-green-600">156 conversions</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <span className="text-xs">Bluetooth Earphones Review</span>
                            <span className="text-xs font-medium text-blue-600">89 engagements</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                            <span className="text-xs">Power Bank Comparison</span>
                            <span className="text-xs font-medium text-purple-600">67 shares</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Settings */}
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold mb-4">Quick Settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">Auto-post new products</span>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">Daily engagement posts</span>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">Email welcome series</span>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">Cart abandonment emails</span>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <Button variant="outline" className="w-full bg-transparent" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Advanced Settings
                        </Button>
                      </div>
                    </div>

                    {/* Upcoming Campaigns */}
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold mb-4">Upcoming Campaigns</h3>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg bg-yellow-50">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium">Black Friday Sale</h4>
                            <span className="text-xs text-muted-foreground">Nov 24</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Multi-channel promotion campaign</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium">Holiday Collection</h4>
                            <span className="text-xs text-muted-foreground">Dec 1</span>
                          </div>
                          <p className="text-xs text-muted-foreground">New product line announcement</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMainTab === "crm" && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Customer Relationship Management</h2>
              <p className="text-muted-foreground mb-4">
                Aggregate all buyer information and Agent conversation records, support user profiling and customer
                relationship management.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Total Customers</h3>
                  <p className="text-2xl font-bold text-blue-600">2,847</p>
                  <p className="text-sm text-muted-foreground">+234 this month</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Active Customers</h3>
                  <p className="text-2xl font-bold text-green-600">1,456</p>
                  <p className="text-sm text-muted-foreground">Active in 30 days</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Repeat Purchase Rate</h3>
                  <p className="text-2xl font-bold text-purple-600">68%</p>
                  <p className="text-sm text-muted-foreground">+5% vs last month</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Customer Satisfaction</h3>
                  <p className="text-2xl font-bold text-orange-600">4.6</p>
                  <p className="text-sm text-muted-foreground">Out of 5.0</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white flex-1">
                <h3 className="font-medium mb-4">Customer List</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">John Smith</h4>
                      <p className="text-sm text-muted-foreground">
                        VIP Customer | Total Spent: $1,258 | Last Chat: 2 hours ago
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">High Value</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Sarah Johnson</h4>
                      <p className="text-sm text-muted-foreground">
                        Regular Customer | Total Spent: $324 | Last Chat: 1 day ago
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Mike Wilson</h4>
                      <p className="text-sm text-muted-foreground">
                        New Customer | Total Spent: $58 | Last Chat: 3 days ago
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">New Customer</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMainTab === "risk" && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Cross-border Compliance Management</h2>
              <p className="text-muted-foreground mb-4">
                Record product listing status in different regions, display regional e-commerce platform requirements
                and product compliance qualifications.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Compliant Products</h3>
                  <p className="text-2xl font-bold text-green-600">892</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Pending Review</h3>
                  <p className="text-2xl font-bold text-yellow-600">45</p>
                  <p className="text-sm text-muted-foreground">Awaiting platform approval</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Risk Products</h3>
                  <p className="text-2xl font-bold text-red-600">12</p>
                  <p className="text-sm text-muted-foreground">Require remediation</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white flex-1">
                <h3 className="font-medium mb-4">Regional Compliance Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">US Market</h4>
                      <p className="text-sm text-muted-foreground">
                        FDA Certified: 85% | FCC Certified: 92% | Tariff Classification: Complete
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Good</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">EU Market</h4>
                      <p className="text-sm text-muted-foreground">
                        CE Certified: 78% | ROHS Certified: 88% | GDPR Compliant: Complete
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Needs Improvement</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Japan Market</h4>
                      <p className="text-sm text-muted-foreground">
                        PSE Certified: 95% | JIS Standard: 90% | Package Labeling: Complete
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Excellent</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMainTab === "stores" && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">Store Management</h2>
              <p className="text-muted-foreground mb-4">
                Display basic information of Agent-operated stores, including store positioning, main categories, and
                operational strategies.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Total Stores</h3>
                  <p className="text-2xl font-bold text-blue-600">8</p>
                  <p className="text-sm text-muted-foreground">Across 5 platforms</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Active Stores</h3>
                  <p className="text-2xl font-bold text-green-600">7</p>
                  <p className="text-sm text-muted-foreground">Currently operating</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Monthly Revenue</h3>
                  <p className="text-2xl font-bold text-purple-600">$240K</p>
                  <p className="text-sm text-muted-foreground">+15% vs last month</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="font-medium mb-2">Average Rating</h3>
                  <p className="text-2xl font-bold text-orange-600">4.7</p>
                  <p className="text-sm text-muted-foreground">Out of 5.0</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white flex-1">
                <h3 className="font-medium mb-4">Store List</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Darwin Digital Flagship Store</h4>
                      <p className="text-sm text-muted-foreground">
                        Platform: Tmall | Position: Premium Digital | Monthly Sales: $68K | Main: Phone Accessories
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Excellent</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Darwin Lifestyle Store</h4>
                      <p className="text-sm text-muted-foreground">
                        Platform: JD.com | Position: Home & Living | Monthly Sales: $42K | Main: Home Products
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Good</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Darwin Global Store</h4>
                      <p className="text-sm text-muted-foreground">
                        Platform: Amazon | Position: Cross-border E-commerce | Monthly Sales: $45K | Main: Consumer
                        Electronics
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Needs Optimization</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full border-t">
        <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {"© "} {new Date().getFullYear()} {" Darwin"}
          </span>
          <span>{"A Multi-Agent AI System for Autonomous E-commerce Operations"}</span>
        </div>
      </footer>
    </main>
  )
}
