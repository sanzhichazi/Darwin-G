"use client";

import * as React from "react";
import WalletConnectButton from "@/components/wallet-connect";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageSquare, Package, Megaphone, Users, Plus, MoreHorizontal, Trash2, Edit, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getConversations, syncConversationsFromDify, type Conversation } from "@/lib/conversation";
import { STORAGE_KEY } from "@/components/wallet-connect";

type SidebarProps = {
  className?: string;
  onSelectTab: (tab: 'chat' | 'products' | 'marketing' | 'crm') => void;
  activeTab: 'chat' | 'products' | 'marketing' | 'crm';
  currentConversationId?: string;
  onSelectConversation: (conversationId: string | undefined) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  refreshTrigger?: number; // Add refresh trigger prop
  isHydrated?: boolean; // Add hydration status prop
};

export function Sidebar({ 
  className, 
  onSelectTab, 
  activeTab, 
  currentConversationId, 
  onSelectConversation, 
  onNewConversation, 
  onDeleteConversation, 
  onRenameConversation,
  refreshTrigger,
  isHydrated: parentIsHydrated 
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [showConversations, setShowConversations] = React.useState(false);
  const lastRefreshProcessedRef = React.useRef<number>(0);

  const setConversationsIfChanged = React.useRef(
    (current: Conversation[], next: Conversation[]) => {
      if (current.length !== next.length) return true;
      for (let i = 0; i < current.length; i++) {
        const a = current[i];
        const b = next[i];
        if (!b || a.id !== b.id || a.title !== b.title || a.updatedAt !== b.updatedAt) return true;
      }
      return false;
    }
  );

  // Load wallet address
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      setWalletAddress(saved);
    }
  }, []);

  // Load conversations when wallet changes - sync with Dify (single pass per wallet change)
  React.useEffect(() => {
    if (walletAddress) {
      // First load local conversations immediately for better UX
      const localConvs = getConversations(walletAddress);
      if (setConversationsIfChanged.current(conversations, localConvs)) {
        setConversations(localConvs);
      }
      
      // Then sync with Dify in background
      syncConversationsFromDify(walletAddress)
        .then(syncedConvs => {
          if (setConversationsIfChanged.current(conversations, syncedConvs)) {
            setConversations(syncedConvs);
          }
          console.log('Synced conversations with Dify:', syncedConvs.length);
        })
        .catch(error => {
          console.warn('Failed to sync conversations with Dify:', error);
        });
    } else {
      setConversations([]);
    }
  }, [walletAddress]);

  // Refresh conversations when refreshTrigger changes (dedup by lastRefreshProcessedRef)
  React.useEffect(() => {
    if (walletAddress && refreshTrigger && refreshTrigger !== lastRefreshProcessedRef.current) {
      // Sync with Dify when refresh is triggered (e.g., after rename)
      syncConversationsFromDify(walletAddress)
        .then(syncedConvs => {
          if (setConversationsIfChanged.current(conversations, syncedConvs)) {
            setConversations(syncedConvs);
          }
          lastRefreshProcessedRef.current = refreshTrigger!;
          console.log('Refreshed conversations with Dify sync:', syncedConvs.length);
        })
        .catch(error => {
          console.warn('Failed to sync conversations during refresh:', error);
          // Fallback to local storage
          const convs = getConversations(walletAddress);
          if (setConversationsIfChanged.current(conversations, convs)) {
            setConversations(convs);
          }
        });
    }
  }, [walletAddress, refreshTrigger]);

  // Listen for wallet changes (storage event only; remove polling to avoid update-depth issues)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      setWalletAddress(prev => (prev === saved ? prev : saved));
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleRename = (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setEditingId(conversationId);
      setEditingTitle(conv.title);
    }
  };

  const confirmRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
      setEditingId(null);
      setEditingTitle("");
      // Refresh conversations
      if (walletAddress) {
        const convs = getConversations(walletAddress);
        setConversations(convs);
      }
    }
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-white transition-all duration-300 ease-in-out h-full min-h-0",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && <h2 className="text-lg font-semibold">Darwin</h2>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn("ml-auto", isCollapsed && "mx-auto")}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>
        <nav className="space-y-2">
          {/* Chat with expandable conversations */}
          {!isCollapsed && parentIsHydrated && walletAddress ? (
            <div>
              <div className="flex items-center gap-1">
                <Button
                  variant={activeTab === 'chat' ? "secondary" : "ghost"}
                  className="flex-1 justify-start"
                  onClick={() => onSelectTab('chat')}
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Chat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={() => setShowConversations(!showConversations)}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showConversations && "rotate-180")} />
                </Button>
              </div>
              
              {/* Expandable conversations list */}
              {showConversations && (
                <div className="mt-2 pl-4 border-l border-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Conversations</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onNewConversation}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-muted",
                          currentConversationId === conv.id && "bg-secondary"
                        )}
                      >
                        {editingId === conv.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmRename();
                              if (e.key === 'Escape') cancelRename();
                            }}
                            className="flex-1 bg-transparent border-none outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          <>
                            <div 
                              className="flex-1 truncate text-xs"
                              onClick={() => onSelectConversation(conv.id)}
                            >
                              {conv.title}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRename(conv.id)}>
                                  <Edit className="h-3 w-3 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => onDeleteConversation(conv.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                        No conversations yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant={activeTab === 'chat' ? "secondary" : "ghost"}
              className={cn("w-full justify-start", isCollapsed && "px-0 justify-center")}
              onClick={() => onSelectTab('chat')}
            >
              <MessageSquare className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
              {!isCollapsed && "Chat"}
            </Button>
          )}
          
          <Button
            variant={activeTab === 'products' ? "secondary" : "ghost"}
            className={cn("w-full justify-start", isCollapsed && "px-0 justify-center")}
            onClick={() => onSelectTab('products')}
          >
            <Package className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Products"}
          </Button>
          <Button
            variant={activeTab === 'marketing' ? "secondary" : "ghost"}
            className={cn("w-full justify-start", isCollapsed && "px-0 justify-center")}
            onClick={() => onSelectTab('marketing')}
          >
            <Megaphone className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Marketing"}
          </Button>
          <Button
            variant={activeTab === 'crm' ? "secondary" : "ghost"}
            className={cn("w-full justify-start", isCollapsed && "px-0 justify-center")}
            onClick={() => onSelectTab('crm')}
          >
            <Users className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
            {!isCollapsed && "CRM"}
          </Button>
        </nav>
      </div>
      <div className="p-4 border-t border-gray-200">
        {/* Wallet connection button at the bottom */}
        <WalletConnectButton 
          label={isCollapsed ? "" : "Connect Wallet"} 
          className={cn(
            "w-full transition-all duration-300",
            isCollapsed && "px-0 justify-center"
          )} 
        />
      </div>
    </aside>
  );
}
