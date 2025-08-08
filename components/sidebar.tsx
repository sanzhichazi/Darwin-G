"use client";

import * as React from "react";
import WalletConnectButton from "@/components/wallet-connect";
import { cn } from "@/lib/utils";

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("w-64 border-r bg-white flex flex-col", className)}>
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Chats</h2>
        <div className="space-y-2">
          {/* Placeholder for chat conversations */}
          <div className="p-2 rounded-md hover:bg-muted cursor-pointer">New Chat</div>
          <div className="p-2 rounded-md hover:bg-muted cursor-pointer text-muted-foreground">Previous Chat 1</div>
          <div className="p-2 rounded-md hover:bg-muted cursor-pointer text-muted-foreground">Previous Chat 2</div>
          <div className="p-2 rounded-md hover:bg-muted cursor-pointer text-muted-foreground">Previous Chat 3</div>
        </div>
      </div>
      <div className="p-4 border-t">
        {/* Wallet connection button at the bottom */}
        <WalletConnectButton label="Connect Wallet" />
      </div>
    </aside>
  );
}
