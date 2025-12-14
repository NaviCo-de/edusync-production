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
import { Plus, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner"; 
import { format, isSameDay, parseISO, isAfter, isBefore } from "date-fns"; 
import { id as ind } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar"; 
import { cn } from "@/lib/utils";

// [PENTING] Import Type Assignment dari AssignmentCard yang baru kita perbaiki
import { AssignmentCard, Assignment } from "../components/AssignmentCard";

interface DashboardAnnouncement {
  id: string;
  content: string;
  createdAt: any;
  classId: string;
  className: string;
  teacherName: string;
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

  // State Assignments
  const [assignments, setAssignments] = useState<{
    ongoing: Assignment[];
    submitted: Assignment[]; 
    graded: Assignment[];
  }>({ ongoing: [], submitted: [], graded: [] });
  
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  // State Calendar
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);

  // --- 1. FETCH GLOBAL ANNOUNCEMENTS ---
  useEffect(() => {
    const fetchRecentUpdates = async () => {
      if (!user || !user.daftarKelas || user.daftarKelas.length === 0) {
        setLoadingUpdates(false);
        return;
      }

      try {
        const promises = user.daftarKelas.map(async (classId: string) => {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          
          if (!classSnap.exists()) return [];
          const classData = classSnap.data();
          const className = classData.name || "Kelas Tanpa Nama";
          const teacherName = classData.teacherName || "Guru";

          const announcementsRef = collection(db, "classes", classId, "announcements");
          const q = query(announcementsRef, orderBy("createdAt", "desc"), limit(5));
          const annSnap = await getDocs(q);

          if (annSnap.empty) return [];

          return annSnap.docs.map(doc => {
             const data = doc.data();
             return {
                id: doc.id,
                content: data.content,
                createdAt: data.createdAt,
                classId: classId,
                className: className,
                teacherName: teacherName
             } as DashboardAnnouncement;
          });
        });

        const results = await Promise.all(promises);
        const allAnnouncements = results.flat();
        const sorted = allAnnouncements.sort((a, b) => {
             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
             return dateB.getTime() - dateA.getTime();
        });

        setRecentUpdates(sorted.slice(0, 3));
      } catch (err) {
        console.error("Gagal fetch updates:", err);
      } finally {
        setLoadingUpdates(false);
      }
    };

    fetchRecentUpdates();
  }, [user]);

  // --- 2. FETCH ASSIGNMENTS (LOGIC FIX) ---
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user || !user.daftarKelas || user.daftarKelas.length === 0) {
        setLoadingAssignments(false);
        return;
      }

      setLoadingAssignments(true);
      try {
        const promises = user.daftarKelas.map(async (classId: string) => {
            // 1. Info Kelas
            const classDoc = await getDoc(doc(db, "classes", classId));
            const className = classDoc.data()?.name || "Kelas";
            const teacherName = classDoc.data()?.teacherName || "Guru";

            // 2. Fetch Chapters
            const chaptersRef = collection(db, "classes", classId, "chapters");
            const chaptersSnap = await getDocs(chaptersRef);

            let classTasks: Assignment[] = [];

            chaptersSnap.forEach((chapDoc) => {
                const chapData = chapDoc.data();
                const subchapters = chapData.subchapters || [];
                
                subchapters.forEach((sub: any) => {
                    const tasks = sub.assignments || [];
                    tasks.forEach((task: any) => {
                        if (task.status === 'published') {
                            // [MAPPING DATA SESUAI ASSIGNMENT CARD BARU]
                            classTasks.push({
                                id: task.id,
                                title: task.title,
                                description: task.description,
                                deadline: task.deadline, // Pakai 'deadline'
                                status: task.status,
                                createdAt: task.publishedAt || task.createdAt, // Tanggal publish
                                
                                classId: classId,
                                className: className,
                                teacherName: teacherName,
                                
                                // Placeholder untuk submission (nanti fetch dari submissions collection)
                                submissionStatus: 'ongoing', 
                            });
                        }
                    });
                });
            });

            return classTasks;
        });

        const results = await Promise.all(promises);
        const allAssignments = results.flat();

        // 3. Sorting & Grouping
        const now = new Date();
        const ongoing = allAssignments.filter(a => a.deadline && isAfter(parseISO(a.deadline), now));
        const past = allAssignments.filter(a => a.deadline && isBefore(parseISO(a.deadline), now));

        // Untuk sementara Past Assignments masuk ke History/Graded biar UI gak kosong
        setAssignments({
            ongoing: ongoing,
            submitted: [], 
            graded: past   
        });

        // 4. Highlight Calendar
        const dates = ongoing.map(a => parseISO(a.deadline!));
        setHighlightedDates(dates);

      } catch (err) {
        console.error("Error fetching assignments:", err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [user]);

  // --- JOIN CLASS LOGIC ---
  const handleJoinClass = async () => {
    if (!inputCode) return;
    setIsJoining(true);

    try {
      const classesRef = collection(db, "classes"); 
      const q = query(classesRef, where("code", "==", inputCode)); 
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Kelas tidak ditemukan");
        setIsJoining(false);
        return;
      }

      const classDoc = querySnapshot.docs[0];
      const classId = classDoc.id;
      const classData = classDoc.data();

      if (user?.daftarKelas?.includes(classId)) {
        toast.warning("Sudah Bergabung");
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
      toast.success(`Berhasil bergabung ke ${classData.name}`);
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
    return format(date, "d MMM yyyy - HH:mm", { locale: ind }); 
  };

  // Logic Calendar Reminder
  const getRemindersForSelectedDate = () => {
    if (!date) return [];
    const all = [...assignments.ongoing, ...assignments.graded];
    return all.filter(task => {
        if (!task.deadline) return false;
        try {
          const taskDate = parseISO(task.deadline);
          return isSameDay(taskDate, date);
        } catch(e) { return false; }
    });
  };

  const selectedReminders = getRemindersForSelectedDate();

  if (loading) return <div className="p-10 text-center">Memuat data murid...</div>;
  if (error) return <div className="p-10 text-red-500 font-bold text-center">{error}</div>;
  if (!user) return <div className="p-10 text-center">Sesi habis. Silakan login kembali.</div>;

  return (
    <div className="px-6 md:px-12 py-10 min-h-screen bg-gray-50/50">
      
      {/* HEADER */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-blue-600 w-fit">
                Welcome Again, {user.nama.split(" ")[0]}!
            </h1>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-transform active:scale-95 rounded-full px-6">
              <Plus className="mr-2 h-4 w-4" />
              Join New Class
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* --- KOLOM KIRI (CONTENT UTAMA) --- */}
        <div className="lg:col-span-3 space-y-10">
            
            {/* 1. LATEST ANNOUNCEMENT */}
            <div>
                <h2 className="text-2xl font-bold text-black mb-6">Latest Announcement</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {loadingUpdates ? (
                         <div className="col-span-3 text-center py-10 text-gray-400">Loading updates...</div>
                    ) : recentUpdates.length > 0 ? (
                        recentUpdates.map((announcement) => (
                            <div key={announcement.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                                <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">{announcement.className}</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    By <span className="text-blue-600 font-medium">{announcement.teacherName}</span> | {formatDate(announcement.createdAt)}
                                </p>
                                <p className="text-gray-600 text-sm line-clamp-4 flex-grow mb-4">
                                    {announcement.content}
                                </p>
                                <Button 
                                    onClick={() => router.push(`/class/${announcement.classId}`)}
                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg mt-auto"
                                >
                                    Lihat Selengkapnya
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 p-8 bg-white border border-dashed rounded-xl text-center text-gray-500">
                           Tidak ada pengumuman terbaru.
                        </div>
                    )}
                </div>
            </div>

            {/* 2. LATEST ASSIGNMENT (3 COLUMNS GRID) */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-black">Latest Assignment</h2>
                    <Button variant="ghost" className="text-yellow-500 hover:text-yellow-600 hover:bg-transparent font-semibold">
                        Lihat Selengkapnya
                    </Button>
                </div>
                
                {loadingAssignments ? (
                    <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600"/></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* COLUMN 1: ON GOING */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-blue-600 text-center mb-2">On Going</h3>
                            {assignments.ongoing.length > 0 ? assignments.ongoing.slice(0, 3).map(task => (
                                <AssignmentCard key={task.id} assignment={task} variant="ongoing" />
                            )) : (
                                <div className="text-center p-4 bg-white rounded-xl border border-dashed text-gray-400 text-sm">No ongoing tasks</div>
                            )}
                        </div>

                        {/* COLUMN 2: GRADED / HISTORY */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-blue-600 text-center mb-2">History (Past Due)</h3>
                             {assignments.graded.length > 0 ? assignments.graded.slice(0, 3).map(task => (
                                <AssignmentCard key={task.id} assignment={task} variant="graded" />
                            )) : (
                                <div className="text-center p-4 bg-white rounded-xl border border-dashed text-gray-400 text-sm">No past tasks</div>
                            )}
                        </div>

                        {/* COLUMN 3: SUBMITTED */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-blue-600 text-center mb-2">Submitted</h3>
                             {assignments.submitted.length > 0 ? assignments.submitted.slice(0, 3).map(task => (
                                <AssignmentCard key={task.id} assignment={task} variant="submitted" />
                            )) : (
                                <div className="text-center p-4 bg-white rounded-xl border border-dashed text-gray-400 text-sm">
                                    No submitted data yet
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>

        </div>

        {/* --- KOLOM KANAN (CALENDAR & REMINDER) --- */}
        <div className="lg:col-span-1 space-y-8">
            
            {/* CALENDAR */}
            <div className="flex justify-center">
                 <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border-none bg-transparent"
                    classNames={{
                        head_cell: "text-gray-500 font-medium text-sm w-9",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-full",
                        day_selected: "bg-black text-white hover:bg-black hover:text-white focus:bg-black focus:text-white rounded-full",
                        day_today: "bg-gray-100 text-gray-900 font-bold",
                    }}
                    modifiers={{
                        hasDeadline: highlightedDates
                    }}
                    modifiersStyles={{
                        hasDeadline: {
                            color: "#2563EB", 
                            fontWeight: "bold",
                            backgroundColor: "#DBEAFE", 
                            borderRadius: "100%"
                        }
                    }}
                />
            </div>

            {/* REMINDER SECTION */}
            <div>
                <h3 className="text-xl font-bold mb-4">Reminder</h3>
                
                <div className="flex flex-col gap-3">
                    {date ? (
                        selectedReminders.length > 0 ? (
                            selectedReminders.map(task => (
                                <div 
                                    key={task.id}
                                    onClick={() => router.push(`/class/${task.classId}/activity`)} 
                                    className="bg-blue-600 text-white p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-blue-700 transition-colors shadow-md group"
                                >
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-sm truncate">{task.title}</p>
                                        <p className="text-xs text-blue-100 mt-1 truncate">
                                            {task.className}
                                        </p>
                                        <p className="text-[10px] text-blue-200 mt-0.5">
                                            Due: {task.deadline ? format(parseISO(task.deadline), "HH:mm") : "-"}
                                        </p>
                                    </div>
                                    <div className="bg-white/20 p-1 rounded-full group-hover:bg-white/30 ml-2 shrink-0">
                                        <ChevronRight className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            ))
                        ) : (
                           <div className="p-6 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                                <p className="text-gray-500 font-medium">Tidak ada deadline di tanggal ini.</p>
                                <p className="text-xs text-gray-400 mt-1">{format(date, "d MMMM yyyy", {locale: ind})}</p>
                           </div> 
                        )
                    ) : (
                        <div className="p-6 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                            <p className="text-gray-500">Pilih tanggal untuk melihat tugas</p>
                        </div>
                    )}
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}