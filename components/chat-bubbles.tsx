"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, FileText, File } from 'lucide-react';

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
        {children}
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
