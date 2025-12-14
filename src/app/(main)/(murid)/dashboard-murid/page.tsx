"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  setDoc,
  serverTimestamp,
  orderBy, 
  limit 
} from "firebase/firestore";

// Services
import { getStudentAssignments, categorizeAssignments, Assignment } from "@/lib/services/assignmentService";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, BookOpen, Bell, ClipboardList, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner"; 
import { ClassCard } from "../components/ClassCard";
import { AssignmentCard } from "../components/AssignmentCard";
import { format } from "date-fns"; 
import { id as ind } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DashboardAnnouncement {
  id: string;
  content: string;
  createdAt: any;
  classId: string;
  className: string;
}

export default function DashboardMurid() {
  const { user, loading, error } = useUserProfile();
  const router = useRouter();
  
  // State Modal Join
  const [open, setOpen] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // State Pengumuman
  const [recentUpdates, setRecentUpdates] = useState<DashboardAnnouncement[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  // 🔥 NEW: State Assignments
  const [assignments, setAssignments] = useState<{
    ongoing: Assignment[];
    submitted: Assignment[];
    graded: Assignment[];
  }>({ ongoing: [], submitted: [], graded: [] });
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  // 🔥 NEW: Active Tab untuk Assignment Section
  const [activeTab, setActiveTab] = useState<'ongoing' | 'submitted' | 'graded'>('ongoing');

  // --- FETCH PENGUMUMAN (EXISTING) ---
  useEffect(() => {
    const fetchRecentUpdates = async () => {
      if (!user || !user.daftarKelas || user.daftarKelas.length === 0) {
        setLoadingUpdates(false);
        return;
      }

      try {
        const promises = user.daftarKelas.map(async (classId) => {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          
          if (!classSnap.exists()) return null;
          const className = classSnap.data().name || "Kelas Tanpa Nama";

          const announcementsRef = collection(db, "classes", classId, "announcements");
          const q = query(announcementsRef, orderBy("createdAt", "desc"), limit(1));
          const annSnap = await getDocs(q);

          if (annSnap.empty) return null;

          const annData = annSnap.docs[0].data();
          
          return {
            id: annSnap.docs[0].id,
            content: annData.content,
            createdAt: annData.createdAt,
            classId: classId,
            className: className,
          } as DashboardAnnouncement;
        });

        const results = await Promise.all(promises);

        const validResults = results
          .filter((item): item is DashboardAnnouncement => item !== null)
          .sort((a, b) => {
             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
             return dateB.getTime() - dateA.getTime();
          });

        setRecentUpdates(validResults);

      } catch (err) {
        console.error("Gagal fetch updates:", err);
      } finally {
        setLoadingUpdates(false);
      }
    };

    fetchRecentUpdates();
  }, [user]);

  // 🔥 NEW: FETCH ASSIGNMENTS
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user || !user.daftarKelas || user.daftarKelas.length === 0) {
        setLoadingAssignments(false);
        return;
      }

      setLoadingAssignments(true);
      try {
        const allAssignments = await getStudentAssignments(user.uid, user.daftarKelas);
        const categorized = categorizeAssignments(allAssignments);
        setAssignments(categorized);
      } catch (err) {
        console.error("Error fetching assignments:", err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [user]);

  // --- JOIN CLASS LOGIC (EXISTING) ---
  const handleJoinClass = async () => {
    if (!inputCode) return;
    setIsJoining(true);

    try {
      const classesRef = collection(db, "classes"); 
      const q = query(classesRef, where("code", "==", inputCode)); 
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Kelas tidak ditemukan", { description: "Kode kelas salah." });
        setIsJoining(false);
        return;
      }

      const classDoc = querySnapshot.docs[0];
      const classId = classDoc.id;
      const classData = classDoc.data();

      if (user?.daftarKelas?.includes(classId)) {
        toast.warning("Sudah Bergabung", { description: "Kamu sudah terdaftar." });
        setIsJoining(false);
        return;
      }

      await Promise.all([
        setDoc(doc(db, "classes", classId, "students", user!.uid), {
          uid: user!.uid,
          nama: user!.nama,
          email: user!.email,
          role: "MURID", 
          joinedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, "users", user!.uid), {
          daftarKelas: arrayUnion(classId) 
        })
      ]);

      setOpen(false);
      setInputCode("");
      toast.success("Berhasil Bergabung!", { description: `Kelas ${classData.name}` });
      window.location.reload(); 

    } catch (err) {
      console.error(err);
      toast.error("Gagal Bergabung");
    } finally {
      setIsJoining(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "d MMM, HH:mm", { locale: ind }); 
  };

  // --- RENDER ---
  if (loading) return <div className="p-10 text-center">Memuat data murid...</div>;
  if (error) return <div className="p-10 text-red-500 font-bold text-center">{error}</div>;
  if (!user) return <div className="p-10 text-center">Sesi habis. Silakan login kembali.</div>;

  // Data untuk Tab Badges
  const tabData = {
    ongoing: { count: assignments.ongoing.length, icon: Clock, color: "yellow" },
    submitted: { count: assignments.submitted.length, icon: ClipboardList, color: "blue" },
    graded: { count: assignments.graded.length, icon: CheckCircle, color: "green" },
  };

  return (
    <div className="px-6 md:px-20 py-10 min-h-screen bg-gray-50/50">
      
      {/* HEADER */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent w-fit">
                Halo, {user.nama}!
            </h1>
            <p className="text-gray-500 mt-1">
                Selamat datang kembali.
            </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-transform active:scale-95">
              <Plus className="mr-2 h-4 w-4" />
              Gabung Kelas
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Gabung Kelas Baru</DialogTitle>
              <DialogDescription>Masukkan kode unik kelas.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Kode</Label>
                <Input
                  id="code"
                  placeholder="Kode Kelas"
                  className="col-span-3 font-bold text-center uppercase"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  disabled={isJoining}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleJoinClass} disabled={isJoining || !inputCode} className="w-full sm:w-auto">
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Gabung Sekarang"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* 🔥 NEW: ASSIGNMENTS SECTION */}
      <div className="mb-10">
        {/* TAB NAVIGATION */}
        <div className="flex gap-6 mb-6 border-b-2 border-gray-200">
          {(Object.keys(tabData) as Array<keyof typeof tabData>).map((tab) => {
            const { count } = tabData[tab];
            const isActive = activeTab === tab;
            
            const labelMap = {
              ongoing: "On Going",
              submitted: "Submitted", 
              graded: "Graded"
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 px-2 font-bold text-base transition-all relative",
                  isActive 
                    ? "text-blue-600 border-b-4 border-blue-600 -mb-0.5" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {labelMap[tab]}
              </button>
            );
          })}
        </div>

        {/* ASSIGNMENT CARDS */}
        {loadingAssignments ? (
          <div className="text-center py-10 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Memuat tugas...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments[activeTab].length > 0 ? (
              assignments[activeTab].map((assignment) => (
                <AssignmentCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  variant={activeTab}
                />
              ))
            ) : (
              <div className="text-center py-16 bg-white border border-dashed rounded-xl">
                <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  {activeTab === 'ongoing' && "Tidak ada tugas aktif saat ini"}
                  {activeTab === 'submitted' && "Belum ada tugas yang disubmit"}
                  {activeTab === 'graded' && "Belum ada tugas yang dinilai"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXISTING SECTIONS (Kelas & Pengumuman) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI (LIST KELAS) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Kelas Saya</h2>
          </div>
          
          {user.daftarKelas && user.daftarKelas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {user.daftarKelas.map((classId: string) => (
                  <ClassCard key={classId} classId={classId} />
               ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-dashed rounded-xl text-center text-gray-500">
               Belum ada kelas. Gabung sekarang!
            </div>
          )}
        </div>

        {/* KOLOM KANAN (UPDATE TERBARU) */}
        <div className="space-y-6">
           <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Pengumuman Terbaru</h2>
           </div>

           <div className="bg-white border rounded-xl shadow-sm p-2 min-h-[200px]">
              {loadingUpdates ? (
                <div className="text-center py-10 text-gray-400 text-sm">Memuat updates...</div>
              ) : recentUpdates.length > 0 ? (
                <div className="divide-y">
                   {recentUpdates.map((update) => (
                      <div 
                        key={update.id} 
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg group"
                        onClick={() => router.push(`/class/${update.classId}`)}
                      >
                         <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                               {update.className}
                            </span>
                            <span className="text-[10px] text-gray-400">
                               {formatDate(update.createdAt)}
                            </span>
                         </div>
                         <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed group-hover:text-gray-900">
                            {update.content}
                         </p>
                      </div>
                   ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">
                   Tidak ada pengumuman baru dari kelasmu.
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}