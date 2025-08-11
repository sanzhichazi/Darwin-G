"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Sparkles, Square } from 'lucide-react';
import {
  MessageBubble,
  AttachmentChips,
  type AttachmentPreview,
} from "@/components/chat-bubbles";
import { cn } from "@/lib/utils";
import { STORAGE_KEY } from "@/components/wallet-connect";
import { 
  saveConversation, 
  deleteConversation,
  generateConversationTitle,
  convertDifyMessagesToLocal,
  getConversations,
  syncConversationsFromDify,
  type Conversation,
  type DifyHistoryResponse
} from "@/lib/conversation";

const CONVERSATION_ID_KEY = "darwin_conversation_id";
import { Sidebar } from "@/components/sidebar"; // Import the new Sidebar component

const BRAND_COLOR = "rgb(249, 217, 247)";

type DragState = "idle" | "over";

export default function Page() {
  const {
    messages,
    sendMessage,
    addToolResult,
    setMessages,
    // Automatically send after tool calls complete (Generative UI pattern)
  } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: (message: any) => {
      console.log('✅ onFinish called with message:', message);
      
      // Reset generation state when finished
      console.log('🔄 Resetting all generation states in onFinish');
      setIsGenerating(false);
      setCurrentTaskId(null);
      setSending(false);
      // Refresh sidebar conversations once after a completed reply
      setConversationRefreshTrigger(prev => prev + 1);
      
      // Clear sending timeout
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }
    },
    onError: (error: any) => {
      console.error('❌ useChat error:', error);
      // Reset all generation states on error
      console.log('🔄 Resetting all generation states in onError');
      setIsGenerating(false);
      setCurrentTaskId(null);
      setSending(false);
      setConnectionError('An error occurred while processing your message. Please try again.');
      
      // Clear sending timeout
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }
    },
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
  const [sending, setSending] = React.useState(false); // 恢复sending状态
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [files, setFiles] = React.useState<AttachmentPreview[]>([]);
  const [drag, setDrag] = React.useState<DragState>("idle");
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");
  const attachMenuRef = React.useRef<HTMLDivElement>(null);
  const attachMenuBottomRef = React.useRef<HTMLDivElement>(null);
  const [activeMainTab, setActiveMainTab] = React.useState<'chat' | 'products' | 'marketing' | 'crm'>('chat'); // State for active main content tab
  const [conversationId, setConversationId] = React.useState<string | undefined>(); // State for Dify conversation continuity
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null); // State for wallet connection
  const [currentConversationId, setCurrentConversationId] = React.useState<string | undefined>(undefined); // Current selected conversation
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = React.useState(0); // Trigger to refresh sidebar
  const [isHydrated, setIsHydrated] = React.useState(false); // Track hydration status

  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const conversationIdRef = React.useRef<string | undefined>(undefined); // Ref to ensure we have the latest conversationId
  const sendingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null); // Track active timeout

  // Hydration and wallet connection status check
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWalletAddress = localStorage.getItem(STORAGE_KEY);
      setWalletAddress(savedWalletAddress);
      setIsHydrated(true); // Mark as hydrated after checking localStorage
    }
  }, []);

  // Listen for wallet connection changes  
  React.useEffect(() => {
    const handleStorageChange = () => {
      const savedWalletAddress = localStorage.getItem(STORAGE_KEY);
      setWalletAddress(savedWalletAddress);
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const savedWalletAddress = localStorage.getItem(STORAGE_KEY);
      // Use the current state value from the callback to avoid dependency issues
      setWalletAddress(currentWalletAddress => {
        if (savedWalletAddress !== currentWalletAddress) {
          return savedWalletAddress;
        }
        return currentWalletAddress;
      });
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []); // Remove walletAddress dependency to prevent infinite loop

  // Removed early reset of sending to avoid hiding loading bubble before text arrives

  // Load conversation history when selecting a conversation
  const loadConversationHistory = React.useCallback(async (conversationId: string) => {
    if (!walletAddress) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}&user=${walletAddress}`);
      if (response.ok) {
        const data: DifyHistoryResponse = await response.json();
        const convertedMessages = convertDifyMessagesToLocal(data.data); // Dify API returns in correct chronological order
        
        // Set the conversation ID first
        setConversationId(conversationId);
        conversationIdRef.current = conversationId;
        
        // Load messages into the chat
        if (setMessages) {
          setMessages(convertedMessages);
        }
        
        console.log('Loaded conversation history:', convertedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      setConnectionError('Failed to load conversation history. Please try again.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [walletAddress]); // Remove setMessages from dependencies to prevent instability

  // Handle conversation selection
  const handleSelectConversation = React.useCallback((conversationId: string | undefined) => {
    setCurrentConversationId(conversationId);
    if (conversationId) {
      loadConversationHistory(conversationId);
    } else {
      // New conversation
      setConversationId(undefined);
      conversationIdRef.current = undefined;
      // Clear messages - this would need to be implemented in useChat
    }
  }, [loadConversationHistory]);

  // Handle new conversation
  const handleNewConversation = React.useCallback(() => {
    setCurrentConversationId(undefined);
    setConversationId(undefined);
    conversationIdRef.current = undefined;
    
    // Clear messages
    if (setMessages) {
      setMessages([]);
    }
  }, []); // Remove setMessages dependency to prevent instability

  // Handle delete conversation
  const handleDeleteConversation = React.useCallback(async (conversationId: string) => {
    if (!walletAddress) return;
    
    try {
      // Call Dify API to delete conversation
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: walletAddress
        })
      });

      if (response.ok) {
        // Delete from local storage after successful API deletion
        deleteConversation(conversationId, walletAddress);
        console.log('Conversation deleted successfully from Dify and local storage');
        
        // If current conversation is being deleted, start new conversation
        if (currentConversationId === conversationId) {
          handleNewConversation();
        }
        
        // Sync with Dify to get the latest data
        try {
          await syncConversationsFromDify(walletAddress);
          console.log('Synced conversations with Dify after delete');
        } catch (error) {
          console.warn('Failed to sync with Dify after delete:', error);
        }
        
        // Trigger sidebar refresh
        setConversationRefreshTrigger(prev => prev + 1);
      } else {
        const errorText = await response.text();
        console.error('Failed to delete conversation:', response.status, errorText);
        setConnectionError('Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setConnectionError('Error deleting conversation. Please check your connection and try again.');
    }
  }, [walletAddress, currentConversationId, handleNewConversation]);

  // Handle rename conversation
  const handleRenameConversation = React.useCallback(async (conversationId: string, newTitle: string) => {
    if (!walletAddress) return;
    
    try {
      // Call Dify API to rename conversation
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTitle,
          user: walletAddress
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Dify API rename response:', responseData);
        
        // Use the title returned by Dify API to ensure consistency
        const confirmedTitle = responseData.name || newTitle;
        
        // Update local storage with the confirmed title
        const { renameConversation } = await import('@/lib/conversation');
        renameConversation(conversationId, confirmedTitle, walletAddress);
        console.log('Conversation renamed successfully to:', confirmedTitle);
        
        // Sync with Dify to get the latest data
        try {
          await syncConversationsFromDify(walletAddress);
          console.log('Synced conversations with Dify after rename');
        } catch (error) {
          console.warn('Failed to sync with Dify after rename:', error);
        }
        
        // Trigger sidebar refresh
        setConversationRefreshTrigger(prev => prev + 1);
      } else {
        const errorText = await response.text();
        console.error('Failed to rename conversation:', response.status, errorText);
        setConnectionError('Failed to rename conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
      setConnectionError('Error renaming conversation. Please check your connection and try again.');
    }
  }, [walletAddress]);

  // Save conversation when new messages are added
  React.useEffect(() => {
    if (messages.length > 0 && walletAddress && conversationId) {
      // Get existing conversations to check if this one already exists
      const existingConversations = getConversations(walletAddress);
      const existingConversation = existingConversations.find(c => c.id === conversationId);
      
      // Get the first user message to generate title (only for new conversations)
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        // Use existing title if conversation exists, otherwise generate new title
        const title = existingConversation 
          ? existingConversation.title 
          : generateConversationTitle(
              firstUserMessage.parts.find(p => p.type === 'text')?.text || ''
            );
        
        const conversation: Conversation = {
          id: conversationId,
          title,
          createdAt: existingConversation?.createdAt || Date.now(),
          updatedAt: Date.now(),
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1]?.parts.find(p => p.type === 'text')?.text || '',
          walletAddress
        };
        
        saveConversation(conversation);
        setCurrentConversationId(conversationId);
      }
    }
  }, [messages, walletAddress, conversationId]);

  // Load conversation ID from localStorage on mount - only run once when messages first appear
  React.useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0 && !conversationId) {
      const savedConversationId = localStorage.getItem(CONVERSATION_ID_KEY);
      if (savedConversationId) {
        setConversationId(savedConversationId);
        conversationIdRef.current = savedConversationId;
        console.log("Loaded conversation ID from storage:", savedConversationId);
      }
    }
  }, [messages.length, conversationId]); // Add conversationId to prevent multiple calls

  // Update ref and localStorage when conversationId changes
  React.useEffect(() => {
    conversationIdRef.current = conversationId;
    if (typeof window !== 'undefined') {
      if (conversationId) {
        localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
        console.log("ConversationId updated and saved:", conversationId);
      } else {
        localStorage.removeItem(CONVERSATION_ID_KEY);
        console.log("ConversationId cleared from storage");
      }
    }
  }, [conversationId]);

  // Add custom stream handling for metadata capture (conversation ID and task ID)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      
      window.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        
        // Only intercept chat API calls
        if (typeof input === 'string' && input.includes('/api/chat') && init?.method === 'POST') {
          console.log('Intercepting chat API call for metadata');
          
          // Clone response to avoid consuming the stream
          const clonedResponse = response.clone();
          
          // Read the stream in background to extract metadata
          setTimeout(async () => {
            try {
              const reader = clonedResponse.body?.getReader();
              if (!reader) return;
              
              let buffer = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                      const parsed = JSON.parse(data);
                      
                      // Handle AI SDK-compatible data-* events (payload in parsed.data)
                      if (parsed.type === 'data-task-id' && parsed.data?.taskId) {
                        const taskId = parsed.data.taskId as string;
                        console.log('Intercepted task ID from data-*:', taskId);
                        setCurrentTaskId(taskId);
                        setIsGenerating(true);
                      }
                      
                      if (parsed.type === 'data-conversation-id' && parsed.data?.conversationId) {
                        const convId = parsed.data.conversationId as string;
                        console.log('Intercepted conversation ID from data-*:', convId);
                        setConversationId(convId);
                        conversationIdRef.current = convId;
                      }
                    } catch (e) {
                      // Skip malformed JSON
                    }
                  }
                }
              }
            } catch (e) {
              console.log('Error reading metadata from stream:', e);
            }
          }, 0);
        }
        
        return response;
      };
      
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, [conversationId]);

  // Reset conversation when messages are cleared (new conversation)
  React.useEffect(() => {
    if (messages.length === 0) {
      setConversationId(undefined);
      conversationIdRef.current = undefined;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CONVERSATION_ID_KEY);
      }
      console.log("Conversation reset - clearing conversation ID");
    }
  }, [messages.length]);

  React.useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Click-outside functionality for attachment menu
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const clickedElement = event.target as Node;
      const isInsideTopMenu = attachMenuRef.current && attachMenuRef.current.contains(clickedElement);
      const isInsideBottomMenu = attachMenuBottomRef.current && attachMenuBottomRef.current.contains(clickedElement);
      
      if (!isInsideTopMenu && !isInsideBottomMenu) {
        setShowAttachMenu(false);
      }
    }

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAttachMenu]);

  // 监听messages变化来停止发送状态（仅在收到首个文本增量后再隐藏加载气泡）
  React.useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !sending) return;
    if (lastMessage.role === 'assistant') {
      const hasNonEmptyText = Array.isArray((lastMessage as any).parts)
        && (lastMessage as any).parts.some((p: any) => p.type === 'text' && typeof p.text === 'string' && p.text.length > 0);
      if (hasNonEmptyText) {
        console.log('AI text started streaming, stopping loading indicator');
        setSending(false);
        if (sendingTimeoutRef.current) {
          clearTimeout(sendingTimeoutRef.current);
          sendingTimeoutRef.current = null;
        }
      }
    }
  }, [messages, sending]);

  const onFilesSelected = React.useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const newItems: AttachmentPreview[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)!;
      // Use a simple UUID fallback for better browser compatibility
      const generateId = () => {
        try {
          return crypto.randomUUID();
        } catch {
          // Fallback for browsers that don't support crypto.randomUUID
          return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
      };
      const id = `${f.name}-${f.size}-${f.lastModified}-${generateId()}`;
      const item: AttachmentPreview = {
        id,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        originalFile: f, // Store the original file
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
    setShowAttachMenu(false);
  }, []);

  const onUrlAdd = React.useCallback(async () => {
    if (!urlInput.trim()) return;
    
    try {
      const url = urlInput.trim();
      // Basic URL validation
      new URL(url);
      
      // Determine file type from URL extension
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      let fileType = 'custom';
      let displayType = 'application/octet-stream';
      
      if (pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
        fileType = 'image';
        displayType = 'image/*';
      } else if (pathname.match(/\.(txt|md|pdf|html|xlsx|docx|csv|xml|epub|pptx)$/)) {
        fileType = 'document';
        displayType = 'text/plain';
      } else if (pathname.match(/\.(mp3|m4a|wav|webm|amr)$/)) {
        fileType = 'audio';
        displayType = 'audio/*';
      } else if (pathname.match(/\.(mp4|mov|mpeg|mpga)$/)) {
        fileType = 'video';
        displayType = 'video/*';
      }

      const filename = pathname.split('/').pop() || 'file-from-url';
      
      // Use a simple UUID fallback for better browser compatibility
      const generateId = () => {
        try {
          return crypto.randomUUID();
        } catch {
          // Fallback for browsers that don't support crypto.randomUUID
          return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
      };

      const urlFile: AttachmentPreview = {
        id: `url-${Date.now()}-${generateId()}`,
        name: filename,
        size: 0, // Unknown size for URL files
        type: displayType,
        url: fileType === 'image' ? url : undefined, // Show preview for images
        isUrl: true,
        fileUrl: url,
        difyFileType: fileType,
      };

      setFiles((prev) => [...prev, urlFile]);
      setUrlInput("");
      setShowUrlInput(false);
      setShowAttachMenu(false);
    } catch (error) {
      setConnectionError("Please enter a valid URL");
    }
  }, [urlInput]);

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
    // Check wallet connection first
    if (!walletAddress) {
      alert("Please connect your wallet first to use chat functionality");
      return;
    }

    if (!input.trim() && files.length === 0) return;

    // Store input and files before clearing them
    const messageText = input;
    const messageFiles = [...files];
    
    // Clear input and files immediately
    setInput("");
    files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    setFiles([]);

    setSending(true);
    setConnectionError(null); // Clear any previous errors
    setIsGenerating(false); // Reset generation state for new message
    setCurrentTaskId(null);
    
    // Clear any existing timeout
    if (sendingTimeoutRef.current) {
      clearTimeout(sendingTimeoutRef.current);
    }
    
    // Set a timeout to reset sending state if no response after 90 seconds
    sendingTimeoutRef.current = setTimeout(() => {
      // Use a ref or check current state to avoid closure issues
      console.log('Message sending timeout, resetting state');
      setSending(false);
      setIsGenerating(false);
      setCurrentTaskId(null);
      setConnectionError('Request timed out. The AI service may be experiencing issues. Please try again.');
      sendingTimeoutRef.current = null;
    }, 90000);
    
    try {
      const currentConversationId = conversationIdRef.current;
      
      console.log("Sending message with conversation ID:", currentConversationId);
      console.log("Message files:", messageFiles);

      // Process files (both local uploads and URLs)
      let uploadedFiles: any[] = [];
      if (messageFiles.length > 0) {
        for (const file of messageFiles) {
          try {
            if (file.isUrl && file.fileUrl) {
              // Validate URL format
              try {
                new URL(file.fileUrl); // This will throw if URL is invalid
                
                // Handle URL files
                uploadedFiles.push({
                  type: file.difyFileType || 'custom',
                  transfer_method: 'remote_url',
                  url: file.fileUrl
                });
                
                console.log('URL file added:', {
                  fileName: file.name,
                  url: file.fileUrl,
                  type: file.difyFileType || 'custom'
                });
              } catch (urlError) {
                console.error('Invalid URL format for file:', file.name, 'URL:', file.fileUrl);
              }
            } else if (file.originalFile) {
              // Handle local file uploads
              const formData = new FormData();
              formData.append('file', file.originalFile);
              formData.append('user', walletAddress);

              const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });

              if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                
                // Validate Dify file upload response
                if (!uploadResult || typeof uploadResult !== 'object') {
                  console.error('Invalid upload response format for:', file.name);
                  continue;
                }

                // Check if the response has the expected Dify file structure
                if (!uploadResult.id) {
                  console.error('Upload response missing file ID for:', file.name, uploadResult);
                  continue;
                }

                // Log the file information received from Dify for debugging
                console.log('File upload successful:', {
                  fileName: file.name,
                  difyResponse: uploadResult
                });
                
                // Determine file type based on MIME type
                let fileType = 'custom';
                if (file.type.startsWith('image/')) {
                  fileType = 'image';
                } else if (
                  file.type.startsWith('text/') || 
                  file.type.includes('json') || 
                  file.type.includes('csv') ||
                  file.type.includes('pdf') ||
                  file.type.includes('document') ||
                  file.type.includes('spreadsheet') ||
                  file.type.includes('xlsx') ||
                  file.type.includes('docx') ||
                  file.type.includes('pptx') ||
                  file.type.includes('html') ||
                  file.type.includes('xml') ||
                  file.type.includes('epub') ||
                  file.name.match(/\.(txt|md|pdf|html|xlsx|docx|csv|xml|epub|pptx)$/i)
                ) {
                  fileType = 'document';
                } else if (file.type.startsWith('audio/')) {
                  fileType = 'audio';
                } else if (file.type.startsWith('video/')) {
                  fileType = 'video';
                }
                
                // Validate the file ID format (Dify typically returns UUIDs)
                const fileId = uploadResult.id;
                if (typeof fileId !== 'string' || fileId.length === 0) {
                  console.error('Invalid file ID format from Dify:', fileId, 'for file:', file.name);
                  continue;
                }
                
                uploadedFiles.push({
                  type: fileType,
                  transfer_method: 'local_file',
                  upload_file_id: fileId
                });
              } else {
                const errorText = await uploadResponse.text().catch(() => 'Unknown error');
                console.error('File upload failed for:', file.name, 'Status:', uploadResponse.status, 'Error:', errorText);
              }
            } else {
              console.warn('File has no originalFile or URL, skipping:', file.name);
            }
          } catch (error) {
            console.error('Error processing file:', file.name, error);
          }
        }
      }

      // Final validation of uploaded files
      const validUploadedFiles = uploadedFiles.filter(file => {
        // Validate file structure
        if (!file || typeof file !== 'object') {
          console.warn('Invalid file object:', file);
          return false;
        }
        
        // Check required fields
        if (!file.type || !file.transfer_method) {
          console.warn('File missing required fields:', file);
          return false;
        }
        
        // Validate transfer method specific requirements
        if (file.transfer_method === 'local_file' && !file.upload_file_id) {
          console.warn('Local file missing upload_file_id:', file);
          return false;
        }
        
        if (file.transfer_method === 'remote_url' && !file.url) {
          console.warn('Remote file missing URL:', file);
          return false;
        }
        
        return true;
      });

      if (validUploadedFiles.length !== uploadedFiles.length) {
        console.warn(`Filtered out ${uploadedFiles.length - validUploadedFiles.length} invalid file(s)`);
        uploadedFiles = validUploadedFiles;
      }

      console.log('Final validated files for Dify:', uploadedFiles);

      // Show user feedback if some files failed to upload
      if (messageFiles.length > 0 && uploadedFiles.length < messageFiles.length) {
        const failedCount = messageFiles.length - uploadedFiles.length;
        setConnectionError(`Warning: ${failedCount} file(s) failed to upload and will only be included as text summary.`);
      }

      // Include file summary for files that couldn't be uploaded
      const attachmentSummary = messageFiles.length > uploadedFiles.length
        ? "\n\n[File Attachments]\n" +
          messageFiles
            .filter((_, idx) => idx >= uploadedFiles.length)
            .map((f, idx) => {
              const base = `${idx + 1}. ${f.name} (${Math.ceil(f.size / 1024)} KB, ${f.type || "unknown"})`;
              const snippet = f.textSample ? `\n---\n${f.textSample}\n---\n` : "";
              return base + (snippet ? `\n${snippet}` : "");
            })
            .join("\n")
        : "";

      // Send message with uploaded files
      await sendMessage({
        parts: [{ type: "text", text: messageText + attachmentSummary }],
        ...(currentConversationId || walletAddress || uploadedFiles.length > 0 ? {
          data: { 
            ...(walletAddress && { walletAddress: walletAddress }),
            ...(currentConversationId && { conversationId: currentConversationId }),
            ...(uploadedFiles.length > 0 && { files: uploadedFiles })
          } as any
        } : {})
      });
      
      // Clear timeout on successful send
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setConnectionError('Failed to send message. Please check your connection and try again.');
      setSending(false);
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }
    }
  }, [input, files, sendMessage, walletAddress]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  const handleStopGeneration = React.useCallback(async () => {
    if (!currentTaskId || !walletAddress) return;

    try {
      console.log('Stopping generation for task:', currentTaskId);
      
      const response = await fetch('/api/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: currentTaskId,
          user: walletAddress,
        }),
      });

      if (response.ok) {
        console.log('Generation stopped successfully');
        setIsGenerating(false);
        setCurrentTaskId(null);
        setSending(false);
      } else {
        console.error('Failed to stop generation:', response.status);
        setConnectionError('Failed to stop generation. Please try again.');
      }
    } catch (error) {
      console.error('Error stopping generation:', error);
      setConnectionError('Error stopping generation. Please check your connection.');
    }
  }, [currentTaskId, walletAddress]);

  return (
    <main className="h-dvh bg-neutral-50 flex flex-col">
      <div className="flex flex-1 overflow-hidden"> {/* Full height container for sidebar and main content */}
        <Sidebar 
          onSelectTab={setActiveMainTab} 
          activeTab={activeMainTab}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          refreshTrigger={conversationRefreshTrigger}
          isHydrated={isHydrated}
        /> {/* Render the new Sidebar component */}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!isHydrated ? (
            // Loading screen during hydration
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : !walletAddress ? (
            // Wallet connection required screen (minimalist welcome)
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-xl text-center mx-auto">
                <div className="mx-auto mb-8 h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 border border-emerald-200/40 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-7 w-7 text-emerald-600" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight mb-3 text-gray-900">
                  <span className="bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">Welcome to Darwin</span>
                </h1>
                <p className="text-gray-600 mb-6 leading-relaxed max-w-prose mx-auto">
                  An AI‑powered multi‑agent system for autonomous e‑commerce operations.
                  Connect your wallet to begin.
                </p>
                <div className="rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm shadow-sm p-5">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="text-sm text-gray-600">
                      <div className="mb-2 font-medium text-gray-800">Supported wallets</div>
                      <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">MetaMask</span>
                        <span className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">OKX Wallet</span>
                        <span className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">Blocto</span>
                    </div>
                  </div>
                    <div className="text-xs text-gray-500">
                      Use the “Connect Wallet” button in the left sidebar to continue.
                </div>
              </div>
            </div>
                <div className="mt-4 text-xs text-gray-500 text-center">
                  By connecting, you agree to a secure, wallet‑bound session. No custodial access.
                </div>
              </div>
            </div>
          ) : (
            // Main content based on selected tab
            <>
              {activeMainTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0">
                <div
                  ref={messagesRef}
                    className="flex-1 min-h-0 overflow-y-auto"
                >
                    <div className="px-6 py-8 mx-auto max-w-4xl w-full">
                    
                  {isLoadingHistory && (
                        <div className="flex items-center justify-center h-full min-h-[60vh]">
                      <div className="text-center">
                            <div className="animate-spin h-10 w-10 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-lg font-medium text-gray-700 mb-1">Loading conversation history</p>
                            <p className="text-sm text-gray-500">Please wait while we retrieve your messages...</p>
                      </div>
                    </div>
                  )}
                  {/* Empty-state like ChatGPT: input centered until first message */}
                  {!isLoadingHistory && messages.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center min-h-[60vh]">
                      <div className="max-w-3xl w-full">
                            <div className="text-center mb-8">
                              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-emerald-600" />
                              </div>
                              <h1 className="text-3xl font-semibold mb-3">{"Welcome to Darwin"}</h1>
                              <p className="text-gray-600 text-lg leading-relaxed mb-2">
                                {'A Multi-Agent AI System for Autonomous E-commerce Operations'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {'Drag & drop product files here or type your message below. Press Ctrl/⌘ + Enter to send.'}
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
                                  <div className="relative" ref={attachMenuRef}>
                              <Button
                                variant="ghost"
                                aria-label="Attach"
                                      className="h-12 w-12 p-0 rounded-xl transition-all duration-200 hover:bg-gray-100/80 hover:shadow-sm border border-gray-200/50 bg-white/60 backdrop-blur-sm flex items-center justify-center"
                                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                                    >
                                      <Paperclip className="h-5 w-5 text-gray-600" />
                                    </Button>
                                    {showAttachMenu && (
                                      <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                                        <button
                                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                          onClick={() => {
                                            document.getElementById('file-input-top')?.click();
                                            setShowAttachMenu(false);
                                          }}
                                        >
                                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            📁
                                          </div>
                                          <div className="text-left">
                                            <div className="font-medium">Upload files</div>
                                            <div className="text-xs text-gray-500">Choose files from your device</div>
                                          </div>
                                        </button>
                                        <button
                                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                          onClick={() => {
                                            setShowUrlInput(true);
                                            setShowAttachMenu(false);
                                          }}
                                        >
                                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                            🔗
                                          </div>
                                          <div className="text-left">
                                            <div className="font-medium">Add from URL</div>
                                            <div className="text-xs text-gray-500">Link to file or image online</div>
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                <input
                                      id="file-input-top"
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => onFilesSelected(e.target.files)}
                                />
                                  </div>
                                  {isGenerating && currentTaskId ? (
                                    <Button
                                      onClick={handleStopGeneration}
                                      variant="outline"
                                      aria-label="Stop generation"
                                      className="h-12 w-12 p-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center justify-center"
                                    >
                                      <Square className="h-5 w-5" />
                              </Button>
                                  ) : (
                              <Button
                                onClick={onSend}
                                disabled={sending || (!input.trim() && files.length === 0)}
                                aria-label="Send"
                                className="h-12 w-12 p-0 rounded-xl flex items-center justify-center"
                              >
                                {sending ? (
                                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Send className="h-5 w-5" />
                                )}
                              </Button>
                                  )}
                            </div>
                                {showUrlInput && (
                                  <div className="mt-3 flex gap-2">
                                    <input
                                      type="url"
                                      value={urlInput}
                                      onChange={(e) => setUrlInput(e.target.value)}
                                      placeholder="Enter file URL (e.g., https://example.com/image.jpg)"
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') onUrlAdd();
                                        if (e.key === 'Escape') {
                                          setShowUrlInput(false);
                                          setUrlInput("");
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      onClick={onUrlAdd}
                                      size="sm"
                                      disabled={!urlInput.trim()}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setShowUrlInput(false);
                                        setUrlInput("");
                                      }}
                                      size="sm"
                                      variant="outline"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
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
                  ) : !isLoadingHistory ? (
                    // Generative UI Chatbot rendering of message parts:
                        <div className="flex flex-col gap-6 pb-8">
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
                                        {(part.input as any)?.message}
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
                                        Confirmation result: {String(part.output || '')}
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
                                    return <div key={callId}>Location: {String(part.output || '')}</div>;
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
                      
                      {/* Loading indicator when sending message */}
                      {sending && (
                        <MessageBubble role="system">
                          <div className="flex items-center gap-3">
                                <div className="flex space-x-1 items-center">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '-0.3s'}}></div>
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '-0.15s'}}></div>
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                            </div>
                                <span className="text-sm text-muted-foreground animate-pulse">
                                  Darwin is thinking...
                                </span>
                          </div>
                        </MessageBubble>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {messages.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
                      <div
                        className={cn(
                          "mx-auto max-w-4xl relative",
                          "bg-white border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200",
                          "p-4",
                          drag === "over" && "ring-2 ring-emerald-400/50 border-emerald-300 bg-emerald-50/30"
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
                      <div className="flex flex-col gap-3">
                        {connectionError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <span className="text-red-500">❌</span>
                            <span>{connectionError}</span>
                            <button 
                              onClick={() => setConnectionError(null)}
                              className="ml-auto text-red-400 hover:text-red-600 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        <div className="flex items-end gap-3">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message or drop files here…"
                            className={cn(
                              "min-h-[56px] max-h-[160px] resize-y",
                              "border-gray-200/50 rounded-xl transition-all duration-200",
                              "focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200/50",
                              "bg-white/80 backdrop-blur-sm",
                              "placeholder:text-gray-400 text-gray-700",
                              "shadow-sm hover:shadow-md focus:shadow-md"
                            )}
                          />
                          <div className="relative" ref={attachMenuBottomRef}>
                      <Button
                        variant="ghost"
                        aria-label="Attach"
                              className={cn(
                                "shrink-0 h-12 w-12 p-0 rounded-xl transition-all duration-200",
                                "hover:bg-gray-100/80 hover:shadow-sm",
                                "border border-gray-200/50 hover:border-gray-300/50",
                                "bg-white/60 backdrop-blur-sm flex items-center justify-center"
                              )}
                              onClick={() => setShowAttachMenu(!showAttachMenu)}
                            >
                              <Paperclip className="h-5 w-5 text-gray-600" />
                            </Button>
                            {showAttachMenu && (
                              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                                <button
                                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={() => {
                                    document.getElementById('file-input-bottom')?.click();
                                    setShowAttachMenu(false);
                                  }}
                                >
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    📁
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium">Upload files</div>
                                    <div className="text-xs text-gray-500">Choose files from your device</div>
                                  </div>
                                </button>
                                <button
                                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={() => {
                                    setShowUrlInput(true);
                                    setShowAttachMenu(false);
                                  }}
                                >
                                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                    🔗
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium">Add from URL</div>
                                    <div className="text-xs text-gray-500">Link to file or image online</div>
                                  </div>
                                </button>
                              </div>
                            )}
                        <input
                              id="file-input-bottom"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => onFilesSelected(e.target.files)}
                        />
                          </div>
                          {isGenerating && currentTaskId ? (
                            <Button
                              onClick={handleStopGeneration}
                              aria-label="Stop generation"
                              className={cn(
                                "shrink-0 h-12 w-12 p-0 rounded-xl transition-all duration-200",
                                "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
                                "shadow-lg hover:shadow-xl",
                                "border-0 text-white font-medium",
                                "transform hover:scale-105 active:scale-95 flex items-center justify-center"
                              )}
                            >
                              <Square className="h-5 w-5" />
                      </Button>
                          ) : (
                      <Button
                        onClick={onSend}
                        disabled={sending || (!input.trim() && files.length === 0)}
                        aria-label="Send"
                              className={cn(
                                "shrink-0 h-12 w-12 p-0 rounded-xl transition-all duration-200",
                                "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
                                "shadow-lg hover:shadow-xl",
                                "disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-sm",
                                "border-0 text-white font-medium",
                                "transform hover:scale-105 active:scale-95 flex items-center justify-center",
                                sending && "animate-pulse"
                              )}
                      >
                        {sending ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                          )}
                    </div>
                        {showUrlInput && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="url"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              placeholder="Enter file URL (e.g., https://example.com/image.jpg)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onUrlAdd();
                                if (e.key === 'Escape') {
                                  setShowUrlInput(false);
                                  setUrlInput("");
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              onClick={onUrlAdd}
                              size="sm"
                              disabled={!urlInput.trim()}
                            >
                              Add
                            </Button>
                            <Button
                              onClick={() => {
                                setShowUrlInput(false);
                                setUrlInput("");
                              }}
                              size="sm"
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                    <AttachmentChips
                      items={files}
                      onRemove={(id) =>
                        setFiles((prev) => prev.filter((f) => f.id !== id))
                      }
                    />
                      </div>
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

              {activeMainTab === 'crm' && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto mx-auto w-full max-w-5xl">
              <h2 className="text-xl font-semibold mb-4">CRM User Management</h2>
              <p className="text-muted-foreground mb-4">
                Manage your buyer information, track interactions, and analyze customer data to enhance your e-commerce operations.
              </p>
              <div className="border rounded-lg p-4 bg-white flex-1 flex items-center justify-center text-center text-muted-foreground">
                <p>Buyer management features will appear here.</p>
              </div>
            </div>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="w-full border-t">
        <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>{"© "} {new Date().getFullYear()} {" Darwin"}</span>
          <span>{"A Multi-Agent AI System for Autonomous E-commerce Operations\n"}</span>
        </div>
      </footer>
    </main>
  );
}
