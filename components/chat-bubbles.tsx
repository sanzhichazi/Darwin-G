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
  url?: string; // object URL for images
  textSample?: string; // snippet for text files
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
  }, [children, isAssistant]);

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

  // Helper function to recursively extract text from React elements
  const extractTextFromElement = (element: React.ReactElement): string => {
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
  };

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow",
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-muted text-foreground"
        )}
      >
        {isAssistant ? (
          content ? (
            <div className="markdown-content prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                // Customize rendering for better chat bubble display
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 last:mb-0 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 last:mb-0 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-1">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <pre className="bg-gray-800 text-gray-100 rounded p-3 my-2 overflow-x-auto text-xs">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2 text-gray-700 dark:text-gray-300">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <table className="border-collapse border border-gray-300 dark:border-gray-600 my-2 text-xs w-full">
                    {children}
                  </table>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-700 font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    {children}
                  </td>
                ),
              }}
                          >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div>
              <div style={{color: 'red', fontSize: '10px'}}>DEBUG: No content extracted</div>
              {children}
            </div>
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
            className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1 text-xs"
          >
            {isImg ? (
              <ImageIcon className="h-4 w-4 text-emerald-600" />
            ) : isText ? (
              <FileText className="h-4 w-4 text-emerald-600" />
            ) : (
              <File className="h-4 w-4 text-emerald-600" />
            )}
            <span className="truncate max-w-[160px]">{f.name}</span>
            <span className="text-muted-foreground">{Math.ceil(f.size / 1024)} KB</span>
            {onRemove ? (
              <button
                className="text-muted-foreground hover:text-foreground"
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
