"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, FileText, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type AttachmentPreview = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string; // object URL for images or direct URL for URL files
  textSample?: string; // snippet for text files
  originalFile?: File; // store original file for upload
  isUrl?: boolean; // indicates if this is a URL file
  fileUrl?: string; // the actual file URL
  difyFileType?: string; // file type for Dify API
};

export function MessageBubble({
  role,
  children,
  className,
}: {
  role: "user" | "assistant" | "system";
  children: React.ReactNode;
  className?: string;
}) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  
  // Helper function to recursively extract text from React elements
  const extractTextFromElement = React.useCallback((element: React.ReactElement): string => {
    if (typeof (element.props as any)?.children === 'string') {
      return (element.props as any).children;
    }
    if (Array.isArray((element.props as any)?.children)) {
      return (element.props as any).children
        .map((child: any) => {
          if (typeof child === 'string') return child;
          if (React.isValidElement(child)) return extractTextFromElement(child);
          return '';
        })
        .join('');
    }
    return '';
  }, []);
  
  // Convert children to string for markdown rendering if it's from assistant
  const content = React.useMemo(() => {
    if (!isAssistant) return null;
    
    // Handle different children structures
    if (typeof children === 'string') {
      return children;
    }
    
    // Handle React element with string content
    if (React.isValidElement(children) && typeof (children.props as any)?.children === 'string') {
      return (children.props as any).children;
    }
    
    // Handle array of React elements (from m.parts.map)
    if (Array.isArray(children)) {
      const textContent = children
        .filter(child => React.isValidElement(child))
        .map(child => {
          if (typeof (child.props as any)?.children === 'string') {
            return (child.props as any).children;
          }
          return '';
        })
        .join('\n\n'); // Join multiple parts with double newlines
      
      return textContent || null;
    }
    
    // Handle single React element from message parts
    if (React.isValidElement(children)) {
      const textContent = extractTextFromElement(children);
      return textContent || null;
    }
    
    return null;
  }, [children, isAssistant, extractTextFromElement]);

  // Determine if there are any renderable children (non-empty)
  const hasRenderableChildren = React.useMemo(() => {
    if (!children) return false;
    if (typeof children === 'string') return children.trim().length > 0;
    if (Array.isArray(children)) return children.some((ch) => React.isValidElement(ch));
    return React.isValidElement(children);
  }, [children]);

  // Debug logging to see what content we're extracting
  React.useEffect(() => {
    if (isAssistant) {
      console.log('MessageBubble Debug:');
      console.log('- isAssistant:', isAssistant);
      console.log('- children:', children);
      console.log('- children type:', typeof children);
      console.log('- extracted content:', content);
      console.log('- content length:', content?.length);
    }
  }, [isAssistant, children, content]);

  // Avoid rendering an empty assistant bubble before any text arrives (after hooks to preserve order)
  const shouldHideAssistantBubble = isAssistant && !content && !hasRenderableChildren;
  if (shouldHideAssistantBubble) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm transition-all duration-200",
          "backdrop-blur-sm transform hover:scale-[1.01]",
          isUser
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700"
            : "bg-gradient-to-br from-white to-gray-50/80 text-gray-800 shadow-md hover:shadow-lg border border-gray-200/50 hover:border-gray-300/50"
        )}
      >
        {isAssistant ? (
          content ? (
            <div className="markdown-content prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                // Customize rendering for better chat bubble display
                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-gray-700">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 ml-4 last:mb-0 list-disc text-gray-700">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 ml-4 last:mb-0 list-decimal text-gray-700">{children}</ol>,
                li: ({ children }) => <li className="mb-1 leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-2 text-gray-900 border-b border-gray-200 pb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 text-gray-900">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-2 text-gray-800">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <pre className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-100 rounded-lg p-4 my-3 overflow-x-auto text-xs shadow-inner border border-gray-700">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-emerald-50 text-emerald-700 rounded-md px-2 py-1 text-xs font-mono border border-emerald-200" {...props}>
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-emerald-300 bg-emerald-50/50 pl-4 py-2 italic my-3 text-gray-700 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-emerald-600 hover:text-emerald-700 hover:underline font-medium transition-colors duration-200" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="w-full text-xs">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-gray-200 px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 font-semibold text-gray-700 text-left">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-gray-100 px-3 py-2 text-gray-600">
                    {children}
                  </td>
                ),
              }}
                          >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div>{children}</div>
          )
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function AttachmentChips({
  items,
  onRemove,
}: {
  items: AttachmentPreview[];
  onRemove?: (id: string) => void;
}) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((f) => {
        const isImg = f.type.startsWith("image/");
        const isText = f.type.startsWith("text/") || f.type.includes("json") || f.type.includes("csv");
        return (
          <div
            key={f.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all duration-200",
              "bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200/50",
              "hover:from-emerald-100 hover:to-emerald-100 hover:border-emerald-300/50 hover:shadow-sm",
              "backdrop-blur-sm"
            )}
          >
            {isImg ? (
              <ImageIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : isText ? (
              <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <File className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            )}
            <span className="truncate max-w-[140px] text-gray-700 font-medium">{f.name}</span>
            <span className="text-emerald-600/70 font-mono">{Math.ceil(f.size / 1024)} KB</span>
            {onRemove ? (
              <button
                className={cn(
                  "text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1",
                  "transition-all duration-200 flex-shrink-0 ml-1",
                  "hover:scale-110 active:scale-95"
                )}
                onClick={() => onRemove(f.id)}
                aria-label={`remove ${f.name}`}
                title={`remove ${f.name}`}
              >
                {'✕'}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
