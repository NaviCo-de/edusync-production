// src/app/(main)/(murid)/chat/components/ChatSidebar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // [PENTING] Import Portal
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const STYLE = {
  widthOpen: "md:w-[280px]",      
  widthClosed: "md:w-[80px]",     
  bgColor: "bg-white",            
  borderColor: "border-gray-200", 
  activeItemColor: "text-blue-600 bg-blue-50", 
  inactiveItemColor: "text-gray-600 hover:text-blue-600 hover:bg-gray-50", 
  newChatBtn: "bg-[#5D87FF] hover:bg-[#4570EA] text-white", 
  fontTitle: "text-[18px]",       
};

type ChatSession = {
  id: string;
  title: string;
  last_updated: any;
};

type ChatSidebarProps = {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  history: ChatSession[];
  currentSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateNewSession: () => void;
  onDeleteSession: (id: string) => void; 
};

export function ChatSidebar({
  isOpen,
  setIsOpen,
  history,
  currentSessionId,
  onSwitchSession,
  onCreateNewSession,
  onDeleteSession
}: ChatSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  // State Context Menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sessionId: string | null;
  }>({ visible: false, x: 0, y: 0, sessionId: null });

  // [FIX] State untuk memastikan Portal hanya jalan di Client Side
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault(); 
    // Koordinat Mouse Akurat
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      sessionId: sessionId
    });
  };

  const handleDeleteClick = () => {
    if (contextMenu.sessionId) {
      onDeleteSession(contextMenu.sessionId);
      setContextMenu({ ...contextMenu, visible: false });
    }
  };

  // Tutup menu saat scroll atau klik di mana saja
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("scroll", handleGlobalClick); // Tutup juga saat scroll agar tidak melayang aneh
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("scroll", handleGlobalClick);
    };
  }, [contextMenu]);

  return (
    <>
      <aside 
        className={cn(
            "flex flex-col border-r transition-all duration-300 ease-in-out h-full z-30 absolute md:static shadow-xl md:shadow-none",
            STYLE.bgColor,
            STYLE.borderColor,
            isOpen 
              ? `w-[85vw] translate-x-0 ${STYLE.widthOpen}`
              : `-translate-x-full md:translate-x-0 ${STYLE.widthClosed}`
        )}
      >
        <div className={cn("flex flex-col gap-4 h-full py-6 transition-all duration-300", isOpen ? "px-6" : "px-2 items-center")}>
            
            {/* HEADER */}
            <div className={cn("flex items-center w-full mb-2 transition-all shrink-0", isOpen ? "justify-between" : "justify-center")}>
                <div className={cn("flex flex-col overflow-hidden transition-all duration-300", isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 h-0 hidden")}>
                    <h2 className={cn("font-bold leading-tight bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent", STYLE.fontTitle)}>Link Your Thoughts</h2>
                    <h2 className={cn("font-bold leading-tight bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent", STYLE.fontTitle)}>With Lynx</h2>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="relative shrink-0 hover:scale-110 transition-transform active:scale-95">
                    <div className="relative w-9 h-9">
                        <Image src={isHovered ? "/door_hovered.svg" : "/door.svg"} alt="Toggle" fill className="object-contain"/>
                    </div>
                </button>
            </div>

            {/* NEW CHAT */}
            {isOpen ? (
                <div className="shrink-0 w-full animate-in fade-in zoom-in duration-300">
                    <Button onClick={onCreateNewSession} className={cn("w-full rounded-2xl h-11 shadow-sm font-semibold flex items-center gap-2 justify-center transition-all", STYLE.newChatBtn)}>
                        <Plus className="w-5 h-5" /><span>New Chat</span>
                    </Button>
                </div>
            ) : (
               <button onClick={onCreateNewSession} className={cn("p-2 rounded-full transition-all mt-2", STYLE.newChatBtn)} title="New Chat"><Plus className="w-6 h-6" /></button>
            )}

            {/* HISTORY LIST */}
            <div className={cn("flex-1 overflow-y-auto pr-1 space-y-1 mt-4 custom-scrollbar w-full transition-all min-h-0", isOpen ? "opacity-100" : "opacity-0 hidden")}>
                <h3 className="text-[10px] font-extrabold text-gray-400 mb-2 uppercase tracking-widest px-2">Recent History</h3>
                {history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2 opacity-60">
                     <MessageSquare className="w-8 h-8 dashed" />
                     <p className="text-xs text-center">Belum ada percakapan</p>
                  </div>
                )}
                {history.map((session) => (
                    <button 
                        key={session.id}
                        onClick={() => onSwitchSession(session.id)}
                        onContextMenu={(e) => handleContextMenu(e, session.id)}
                        className={cn("w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all truncate flex items-center gap-3 relative group", currentSessionId === session.id ? STYLE.activeItemColor : STYLE.inactiveItemColor)}
                    > 
                        <span className="truncate flex-1">{session.title}</span>
                        {currentSessionId === session.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                ))}
            </div>

            {/* BACK BUTTON */}
            {isOpen && (
                <div className="pt-3 w-full border-t border-gray-100 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Button variant="ghost" className="w-full justify-start text-gray-500 hover:text-blue-600 hover:bg-blue-50 gap-2 px-2" onClick={() => window.history.back()}>
                        <ChevronLeft className="w-5 h-5" /><span className="font-medium">Kembali</span>
                    </Button>
                </div>
            )}
        </div>
      </aside>

      {/* [FIX] CONTEXT MENU MENGGUNAKAN PORTAL */}
      {/* Ini akan me-render menu langsung di body HTML, bukan di dalam sidebar yg sempit/bergerak */}
      {mounted && contextMenu.visible && createPortal(
        <div 
          className="fixed z-[9999] bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden py-1 w-40 animate-in fade-in zoom-in duration-150"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          // Mencegah menu menutup saat diklik di dalamnya
          onClick={(e) => e.stopPropagation()} 
        >
          <button 
            onClick={handleDeleteClick}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Chat
          </button>
        </div>,
        document.body
      )}
    </>
  );
}