"use client";

import * as React from "react";
import WalletConnectButton from "@/components/wallet-connect";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageSquare, Package, Megaphone } from 'lucide-react';

export function Sidebar({ className }: { className?: string }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-white transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && <h2 className="text-lg font-semibold">Chats</h2>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>
        <nav className="space-y-2">
          <Button
            variant="ghost"
            className={cn("w-full justify-start", isCollapsed && "px-0 justify-center")}
          >
            <MessageSquare className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "New Chat"}
          </Button>
          <Button
            variant="ghost"
            className={cn("w-full justify-start text-muted-foreground", isCollapsed && "px-0 justify-center")}
          >
            <MessageSquare className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Previous Chat 1"}
          </Button>
          <Button
            variant="ghost"
            className={cn("w-full justify-start text-muted-foreground", isCollapsed && "px-0 justify-center")}
          >
            <MessageSquare className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Previous Chat 2"}
          </Button>
          <Button
            variant="ghost"
            className={cn("w-full justify-start text-muted-foreground", isCollapsed && "px-0 justify-center")}
          >
            <MessageSquare className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Previous Chat 3"}
          </Button>
        </nav>
      </div>
      <div className="p-4 border-t">
        {/* Wallet connection button at the bottom */}
        <WalletConnectButton label={isCollapsed ? "" : "Connect Wallet"} className={cn("w-full", isCollapsed && "px-0 justify-center")} />
      </div>
    </aside>
  );
}
