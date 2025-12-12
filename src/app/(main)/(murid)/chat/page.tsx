'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Send, 
  ChevronLeft,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

// URL Backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"; 

type Message = {
  id?: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'flashcard' | 'error';
  data?: any; 
  timestamp?: any;
};

type ChatSession = {
  id: string;
  title: string;
  last_updated: any;
};

// --- KOMPONEN INPUT (DIPISAH SUPAYA KEYBOARD AMAN) ---
type InputAreaProps = {
  input: string;
  setInput: (val: string) => void;
  handleSend: () => void;
  loading: boolean;
  selectedFile: File | null;
  preview: string | null;
  clearFile: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isCentered?: boolean;
};

const InputArea = ({ 
  input, 
  setInput, 
  handleSend, 
  loading, 
  selectedFile, 
  preview, 
  clearFile, 
  handleFileSelect, 
  fileInputRef,
  isCentered 
}: InputAreaProps) => {
  return (
    <div className={cn(
      "w-full max-w-3xl flex flex-col bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 transition-all duration-300 mx-auto",
      isCentered ? "shadow-md" : ""
    )}>
       {selectedFile && (
         <div className="px-6 pt-3 flex items-center gap-2">
             <div className="relative group bg-gray-50 border rounded-lg p-2 pr-8 flex items-center gap-3">
                 {preview ? (
                     <div className="relative w-8 h-8 rounded overflow-hidden border">
                         <Image src={preview} alt="Preview" fill className="object-cover" />
                     </div>
                 ) : (
                     <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-500">
                         <FileText className="w-5 h-5" />
                     </div>
                 )}
                 <div className="flex flex-col">
                     <span className="text-xs font-semibold max-w-[150px] truncate">{selectedFile.name}</span>
                     <span className="text-[10px] text-gray-500">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                 </div>
                 <button 
                     onClick={clearFile}
                     className="absolute top-1 right-1 bg-gray-200 hover:bg-red-100 hover:text-red-500 rounded-full p-0.5 transition"
                 >
                     <X className="w-3 h-3" />
                 </button>
             </div>
         </div>
       )}

       <div className="flex items-center px-4 py-2 gap-2">
           <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             onChange={handleFileSelect}
             accept="image/*,application/pdf"
           />
           
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="p-2 text-gray-500 hover:text-blue-base transition hover:bg-blue-50 rounded-full"
             title="Upload Gambar/PDF"
           >
              <Plus className="w-5 h-5" />
           </button>
           
           <Input 
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSend()}
             placeholder={selectedFile ? "Tambahkan keterangan..." : "Tanyakan Materimu Di sini!"}
             className="flex-1 border-none shadow-none focus-visible:ring-0 text-base px-2 h-10 bg-transparent placeholder:text-gray-400 font-medium"
           />
           
           <button 
             onClick={handleSend}
             disabled={loading || (!input && !selectedFile)}
             className={cn(
                 "p-2 rounded-full transition-all duration-200",
                 (input || selectedFile) ? "text-blue-base hover:bg-blue-50" : "text-gray-400"
             )}
           >
              {input || selectedFile ? <Send className="w-5 h-5" /> : <Search className="w-5 h-5" />}
           </button>
       </div>
    </div>
  );
};

export default function ChatPage() {
  const { user } = useUserProfile();
  
  // -- STATE --
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [history, setHistory] = useState<ChatSession[]>([]);
  
  // State UI & Hover
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false); // Untuk efek hover logo
  
  // File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. INIT
  useEffect(() => {
    if (!sessionId) setSessionId(uuidv4());
  }, [sessionId]);

  // 2. FETCH HISTORY
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'chat_rooms'),
      where('user_id', '==', user.uid),
      orderBy('last_updated', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || "Percakapan Baru",
        last_updated: doc.data().last_updated
      }));
      setHistory(rooms);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. FETCH MESSAGES
  useEffect(() => {
    if (!sessionId) return;
    const q = query(
      collection(db, 'chat_rooms', sessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, preview]);

  // --- LOGIC ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal 5MB");
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || !user) return;
    const userMsg = input;
    const currentFile = selectedFile;
    setInput('');
    clearFile();
    setLoading(true);

    try {
      let payload: any = {
        message: userMsg || (currentFile ? "Lampiran File" : ""),
        session_id: sessionId,
        user_id: user.uid,
        history: []
      };
      if (currentFile) {
        const base64String = await fileToBase64(currentFile);
        payload.file_base64 = base64String;
        payload.mime_type = currentFile.type;
      }
      await axios.post(`${API_URL}/chat/message`, payload);
    } catch (error) {
      console.error("Gagal kirim pesan:", error);
    } finally {
      setLoading(false);
    }
  };

  const switchSession = (id: string) => {
    setSessionId(id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const createNewSession = () => {
    setSessionId(uuidv4());
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // --- RENDER MESSAGE ---
  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.role === 'user';
    return (
      <div key={msg.id || index} className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
        <div className={cn("flex max-w-[85%] md:max-w-[70%] gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
          <div className="shrink-0 mt-1">
            {isUser ? (
               <div className="w-8 h-8 rounded-full bg-blue-base flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
                  {user?.nama?.charAt(0) || "U"}
               </div>
            ) : (
               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center p-1.5 shadow-md">
                  <Image src="/lynx_logo.png" width={30} height={30} alt="AI" className="object-contain invert brightness-0" /> 
               </div>
            )}
          </div>
          <div className={cn(
            "p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all overflow-hidden",
            isUser 
              ? "bg-blue-base text-white rounded-tr-none" 
              : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
          )}>
            {msg.type === 'flashcard' ? (
               <div className="space-y-3 min-w-[250px]">
                  <div className="flex items-center gap-2 border-b border-white/20 pb-2 mb-2">
                    <span className="font-bold">📚 Flashcard Set</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                     <p className="font-bold text-lg">{msg.data?.topic}</p>
                     <p className="text-xs opacity-80">{msg.data?.cards?.length} Kartu Pembelajaran</p>
                  </div>
                  {msg.data?.pdf_base64 && (
                    <a 
                      href={`data:application/pdf;base64,${msg.data.pdf_base64}`} 
                      download={`Flashcard-${msg.data.topic}.pdf`}
                      className="flex items-center justify-center gap-2 p-2 bg-white text-blue-base rounded-lg hover:bg-gray-100 transition cursor-pointer font-semibold text-xs"
                    >
                       <Image src="/pdf_logo.png" width={16} height={16} alt="PDF" />
                       Download PDF
                    </a>
                  )}
               </div>
            ) : (
               <div className={cn("prose prose-sm max-w-none break-words", isUser ? "prose-invert" : "")}>
                 <ReactMarkdown 
                    components={{
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1" {...props} />,
                        li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                        strong: ({node, ...props}) => <strong className={cn("font-bold", isUser ? "text-white" : "text-blue-900")} {...props} />
                    }}
                 >
                   {msg.content}
                 </ReactMarkdown>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER UTAMA ---
  return (
    // [UPDATE] Kembali ke layout Flex Relative (Bukan Fixed) agar sesuai header
    <div className="relative flex h-[calc(100vh-120px)] w-full bg-[#F8F9FC] overflow-hidden rounded-[20px] my-6">
      
      {/* SIDEBAR */}
      <aside 
        className={cn(
            "flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out h-full z-30",
            "absolute md:static",
            isSidebarOpen 
              ? "w-[85vw] md:w-[280px] translate-x-0" 
              : "-translate-x-full md:translate-x-0 md:w-[80px]"
        )}
      >
        <div className={cn(
            "flex flex-col gap-4 h-full py-6 transition-all duration-300",
            isSidebarOpen ? "px-6" : "px-2 items-center"
        )}>
            
            {/* Header Sidebar & Toggle */}
            <div className={cn(
                "flex items-center w-full mb-2 transition-all shrink-0",
                isSidebarOpen ? "justify-between" : "justify-center"
            )}>
                {/* Teks Judul (Hanya Muncul Jika Open) */}
                <div className={cn(
                    "flex flex-col overflow-hidden transition-all duration-300",
                    isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 h-0 hidden"
                )}>
                    <h2 className="text-[18px] font-bold leading-tight bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                      Link Your Thoughts
                    </h2>
                    <h2 className="text-[18px] font-bold leading-tight bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                      With Lynx
                    </h2>
                </div>

                {/* LOGO PINTU (Toggle Button) + Hover Effect */}
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="relative shrink-0 hover:scale-105 transition-transform"
                    title="Toggle Sidebar"
                >
                    {/* [UPDATE] Size Logo w-9 h-9 */}
                    <div className={cn("relative transition-all", isSidebarOpen ? "w-9 h-9" : "w-9 h-9")}>
                        {/* [UPDATE] Ganti gambar saat hover */}
                        <Image 
                            src={isHovered ? "/book_hovered.svg" : "/door.png"} 
                            alt="Toggle Sidebar" 
                            fill 
                            className="object-contain"
                        />
                    </div>
                </button>
            </div>

            {/* Tombol New Chat (HANYA MUNCUL JIKA SIDEBAR OPEN) */}
            {isSidebarOpen && (
                <div className="shrink-0 w-full animate-in fade-in zoom-in duration-300">
                    <Button 
                        onClick={createNewSession}
                        className="w-full bg-[#5D87FF] hover:bg-[#4570EA] text-white rounded-[16px] h-10 shadow-sm font-semibold flex items-center gap-2 justify-center"
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5" />
                        <span>New Chat</span>
                    </Button>
                </div>
            )}

            {/* History List (Hanya Muncul Jika Open) */}
            <div className={cn(
                "flex-1 overflow-y-auto pr-1 space-y-1 mt-2 custom-scrollbar w-full transition-all min-h-0",
                isSidebarOpen ? "opacity-100" : "opacity-0 hidden"
            )}>
                <h3 className="text-xs font-bold text-black mb-3 uppercase tracking-wider sticky top-0 bg-white pb-2 z-10">History</h3>
                {history.length === 0 && <p className="text-xs text-gray-400 italic px-2">Belum ada riwayat.</p>}
                
                {history.map((session) => (
                    <button 
                        key={session.id}
                        onClick={() => switchSession(session.id)}
                        className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all truncate",
                            sessionId === session.id 
                            ? "bg-transparent text-blue-base font-bold" 
                            : "text-blue-40 hover:text-blue-base"
                        )}
                    >
                        {session.title}
                    </button>
                ))}
            </div>

            {/* Footer Back (HANYA MUNCUL JIKA SIDEBAR OPEN) */}
            {isSidebarOpen && (
                <div className="pt-3 w-full border-t border-gray-100 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-blue-90 hover:text-blue-base gap-2 px-0"
                        onClick={() => window.history.back()}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back
                    </Button>
                </div>
            )}
        </div>
      </aside>

      {/* --- MAIN CHAT --- */}
      <section className="flex-1 flex flex-col relative w-full h-full bg-[#F8F9FC]">
        {/* Toggle Button MOBILE Only */}
        <div className="absolute top-4 left-4 z-20 md:hidden">
            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="bg-white shadow-sm border-gray-200"
            >
               <div className="relative w-6 h-6">
                  <Image src="/door.png" alt="Toggle" fill className="object-contain" />
               </div>
            </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-8 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 gap-6 animate-in fade-in zoom-in duration-500">
               <div className="flex items-center gap-4 mb-2">
                   {/* [UPDATE] Logo Empty State GEDE (w-28) */}
                   <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0">
                      <Image 
                        src="/lynx_logo.png" 
                        fill 
                        alt="Lynx Logo" 
                        className="object-contain" 
                        priority 
                      />
                   </div>
                   <h1 
                     className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent tracking-tight py-2"
                   >
                     Halo, {user?.nama || "Sobat"}!
                   </h1>
               </div>
               
               <div className="w-full max-w-2xl">
                  {/* PASS PROPS (Input Tetap Fokus) */}
                  <InputArea 
                    input={input}
                    setInput={setInput}
                    handleSend={handleSend}
                    loading={loading}
                    selectedFile={selectedFile}
                    preview={preview}
                    clearFile={clearFile}
                    handleFileSelect={handleFileSelect}
                    fileInputRef={fileInputRef}
                    isCentered={true}
                  />
               </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto pb-4">
               {messages.map((msg, idx) => renderMessage(msg, idx))}
               {loading && (
                 <div className="flex w-full mb-6 justify-start">
                    <div className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                       <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center gap-1">
                             <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                             <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                             <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                       </div>
                    </div>
                 </div>
               )}
               <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* --- INPUT AREA (BOTTOM) --- */}
        {messages.length > 0 && (
            <div className="p-4 md:p-6 w-full flex justify-center bg-[#F8F9FC]">
                <InputArea 
                    input={input}
                    setInput={setInput}
                    handleSend={handleSend}
                    loading={loading}
                    selectedFile={selectedFile}
                    preview={preview}
                    clearFile={clearFile}
                    handleFileSelect={handleFileSelect}
                    fileInputRef={fileInputRef}
                />
            </div>
        )}

      </section>
    </div>
  );
}