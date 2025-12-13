"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import { useUserProfile } from "@/lib/hooks/useUserProfile"; 
import { format } from "date-fns"; 

// [UPDATE] Interface Data Kelas: Tambah teacherName
interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  teacherId: string;
  teacherName?: string; // Kita ambil nama guru dari sini
  studentCount: number;
  studentIds: string[];
}

// [UPDATE] Interface Announcement: Lebih Simpel
interface Announcement {
  id: string;
  content: string;
  createdAt: any; 
  // Tidak ada authorName/ID lagi
}

export default function ClassDetail() {
  const { id } = useParams(); 
  const router = useRouter();
  const { user } = useUserProfile(); 
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stream' | 'people'>('stream');

  // State Form
  const [isPosting, setIsPosting] = useState(false);
  const [inputContent, setInputContent] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  // 1. Fetch Detail Kelas
  useEffect(() => {
    const fetchClassDetail = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "classes", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setClassData({ id: docSnap.id, ...docSnap.data() } as ClassData);
        } else {
          alert("Kelas tidak ditemukan!");
          router.push("/dashboard-guru");
        }
      } catch (error) {
        console.error("Error fetching class:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetail();
  }, [id, router]);

  // 2. Realtime Announcements
  useEffect(() => {
    if (!id) return;

    const q = query(
      collection(db, "classes", id as string, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Announcement[];
      setAnnouncements(data);
    });

    return () => unsubscribe(); 
  }, [id]);

  // 3. [UPDATE] Logic Posting Lebih Simpel
  const handlePostAnnouncement = async () => {
    if (!inputContent.trim()) return;
    if (!user) return alert("Anda harus login!");

    setIsPosting(true);
    try {
      // Hanya simpan Content & Waktu. Author dianggap pemilik kelas.
      await addDoc(collection(db, "classes", id as string, "announcements"), {
        content: inputContent,
        createdAt: serverTimestamp(),
      });

      setInputContent("");
      setIsInputExpanded(false);
    } catch (error) {
      console.error("Gagal memposting:", error);
      alert("Gagal memposting pengumuman.");
    } finally {
      setIsPosting(false);
    }
  };

  const copyToClipboard = () => {
    if (classData?.code) {
      navigator.clipboard.writeText(classData.code);
      alert("Kode kelas disalin!");
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Memposting...";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "d MMM yyyy, HH:mm");
  };

  if (loading) return <div className="p-10 text-center">Memuat kelas...</div>;
  if (!classData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {/* --- HEADER (Tetap Sama) --- */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-48 h-32 shrink-0 rounded-lg overflow-hidden border bg-gray-100">
               {classData.imageUrl ? (
                 <img src={classData.imageUrl} alt="Class Logo" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
               )}
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">{classData.name}</h1>
              <p className="text-gray-500">{classData.description || "Tidak ada deskripsi untuk kelas ini."}</p>
              <div className="flex items-center gap-4 mt-4 pt-2">
                 <div 
                    onClick={copyToClipboard}
                    className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-md font-mono text-sm flex items-center gap-2 hover:bg-blue-100 transition-colors"
                    title="Klik untuk copy"
                 >
                    <span>Kode: <strong>{classData.code}</strong></span>
                    <span className="text-xs opacity-50">📋</span>
                 </div>
                 <span className="text-sm text-gray-500">
                    {classData.studentCount || 0} Murid Bergabung
                 </span>
              </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" onClick={() => router.push('/dashboard-guru')}>Kembali</Button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-5xl mx-auto px-6 mt-4 flex gap-6 text-sm font-medium text-gray-500">
          <button 
            onClick={() => setActiveTab('stream')}
            className={`pb-3 border-b-2 px-1 ${activeTab === 'stream' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-gray-700'}`}
          >
            Forum & Materi
          </button>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* TAB: STREAM */}
        {activeTab === 'stream' && (
          <div className="space-y-6">
            
            {/* INPUT AREA */}
            <div className="bg-white p-4 rounded-xl shadow-sm border transition-all">
               {isInputExpanded ? (
                 <div className="space-y-4">
                   <Textarea 
                      placeholder="Apa yang ingin Anda umumkan ke kelas?" 
                      className="min-h-[120px] resize-none text-base"
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      autoFocus
                   />
                   <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setIsInputExpanded(false)}>Batal</Button>
                      <Button onClick={handlePostAnnouncement} disabled={isPosting || !inputContent.trim()}>
                        {isPosting ? "Memposting..." : "Posting"}
                      </Button>
                   </div>
                 </div>
               ) : (
                 <div 
                    onClick={() => setIsInputExpanded(true)}
                    className="flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors p-2 rounded-lg"
                 >
                    <Avatar>
                      {/* Avatar Guru yang sedang login */}
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {user?.nama?.charAt(0) || "G"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-gray-400 text-sm flex-1">Umumkan sesuatu ke kelas anda...</p>
                 </div>
               )}
            </div>

            {/* LIST ANNOUNCEMENTS */}
            <div className="space-y-4">
              {announcements.length > 0 ? (
                announcements.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar>
                        {/* Karena tidak ada foto di announcement, kita pakai inisial TeacherName dari ClassData */}
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {classData.teacherName?.charAt(0) || "T"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {/* [UPDATE] Nama author diambil dari classData.teacherName */}
                        <p className="font-semibold text-gray-900 text-sm">
                            {classData.teacherName || "Guru"}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                      {item.content}
                    </div>
                  </div>
                ))
              ) : (
                 <div className="text-center py-10 border-2 border-dashed rounded-xl">
                   <p className="text-gray-400 mb-2">Belum ada postingan materi atau tugas.</p>
                 </div>
              )}
            </div>

          </div>
        )}

        {/* TAB: PEOPLE */}
        

      </div>
    </div>
  );
}