"use client";

import { useEffect, useState } from "react";
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
  Timestamp 
} from "firebase/firestore";

// UI Components
import { Input } from "@/components/ui/input";
import { Search, Bell, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// --- 1. DEFINISI TIPE DATA (Sesuai Database) ---

interface GradeItem {
  id: string;           // ID Assignment
  assignmentTitle: string;
  className: string;    // Nama Kelas (Matematika, Biologi, dll)
  classId: string;
  score: number | null; // Nilai (null jika belum dinilai)
  maxPoints: number;    // Nilai maksimal soal
  status: "GRADED" | "SUBMITTED" | "LATE" | "MISSING" | "ON_GOING";
  submittedAt: string | null; // Tanggal submit formatted
  deadline: string | null;    // Deadline formatted
  feedback: string | null;    // Feedback guru
}

// --- 2. KOMPONEN KECIL (UI) ---

const ScoreBox = ({ score, maxPoints, status }: { score: number | null, maxPoints: number, status: string }) => {
  // Jika belum submit atau belum dinilai
  if (score === null) {
    const isSubmitted = status === "SUBMITTED" || status === "LATE";
    return (
      <div className={cn(
        "w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-[20px] flex flex-col justify-center items-center shrink-0 border-2",
        isSubmitted ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"
      )}>
        <span className={cn(
          "text-xs font-bold text-center px-2",
          isSubmitted ? "text-blue-600" : "text-gray-400"
        )}>
          {isSubmitted ? "Dinilai..." : "No Score"}
        </span>
      </div>
    );
  }

  // Logic Warna Nilai
  // Hijau > 75, Kuning > 50, Merah < 50
  const isGood = score >= 75;
  const isAvg = score >= 50 && score < 75;
  
  return (
    <div className={cn(
      "w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-[20px] flex flex-col justify-center items-center shrink-0 transition-all shadow-sm border",
      isGood ? "bg-green-50 text-green-700 border-green-200" : 
      isAvg ? "bg-yellow-50 text-yellow-700 border-yellow-200" : 
      "bg-red-50 text-red-600 border-red-200"
    )}>
      <span className="text-3xl md:text-4xl font-bold tracking-tighter">{score}</span>
      <span className="text-[10px] md:text-xs font-semibold mt-1 opacity-70">/{maxPoints}</span>
    </div>
  );
};

const GradeCard = ({ grade }: { grade: GradeItem }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "GRADED": return "bg-green-100 text-green-700";
      case "SUBMITTED": return "bg-blue-100 text-blue-700";
      case "LATE": return "bg-orange-100 text-orange-700";
      case "MISSING": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-gray-100 hover:shadow-md transition-all duration-300">
      {/* HEADER KARTU (Selalu Terlihat) */}
      <div 
        className="flex items-start gap-4 md:gap-6 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* KIRI: Kotak Nilai */}
        <ScoreBox score={grade.score} maxPoints={grade.maxPoints} status={grade.status} />

        {/* TENGAH: Informasi Utama */}
        <div className="flex-1 pt-1 min-w-0">
          {/* Badge Kelas */}
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-gray-100 text-gray-500 mb-2">
            {grade.className}
          </span>
          
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 line-clamp-1 truncate pr-4">
            {grade.assignmentTitle}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Clock className="w-4 h-4" />
            <span>Deadline: {grade.deadline || "No Deadline"}</span>
          </div>
          
          {/* Preview Feedback (Muncul saat tertutup) */}
          {!isOpen && grade.feedback && (
            <p className="text-sm text-gray-400 mt-3 line-clamp-1">
              <span className="text-blue-600 font-semibold">Feedback: </span>
              {grade.feedback}
            </p>
          )}
        </div>

        {/* KANAN: Icon Toggle */}
        <div className="pt-2 text-gray-400">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {/* BODY KARTU (Muncul saat dibuka/expanded) */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        isOpen ? "grid-rows-[1fr] mt-6 opacity-100" : "grid-rows-[0fr] mt-0 opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="border-t border-gray-100 pt-6">
            
            {/* Feedback Section */}
            <div className="mb-6">
              <p className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                 Feedback Guru
                 {grade.feedback && <CheckCircle className="w-4 h-4 text-green-500" />}
              </p>
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-50">
                <p className="text-gray-600 leading-relaxed text-sm md:text-base italic">
                    {grade.feedback ? `"${grade.feedback}"` : "Belum ada feedback yang diberikan untuk tugas ini."}
                </p>
              </div>
            </div>

            {/* Table Info Status */}
            <div className="bg-gray-50 rounded-xl p-4 md:px-8 md:py-6">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-3">
                <span className="font-bold text-gray-900 text-sm">Status Pengerjaan</span>
                <span className={cn(
                  "font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider",
                  getStatusColor(grade.status)
                )}>
                  {grade.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 text-sm">Dikumpulkan Pada</span>
                <span className="text-gray-600 text-sm font-medium">
                    {grade.submittedAt || "-"}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. HALAMAN UTAMA ---

export default function MyGradesPage() {
  const { user, loading: userLoading } = useUserProfile();
  const router = useRouter();

  // State
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // FETCH DATA ENGINE
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.uid || !user.daftarKelas) {
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        // 1. Ambil Data Kelas (Untuk Nama Kelas & Filter)
        const classMap: Record<string, string> = {}; // id -> nama
        const classPromises = user.daftarKelas.map(async (classId) => {
            const snap = await getDoc(doc(db, "classes", classId));
            if (snap.exists()) {
                const name = snap.data().name || snap.data().nama || "Kelas Tanpa Nama";
                classMap[classId] = name;
                return name;
            }
            return null;
        });
        
        const classNames = (await Promise.all(classPromises)).filter(Boolean) as string[];
        setClassFilters(["Semua", ...classNames]);

        // 2. Ambil Modules (Tugas)
        // Kita butuh tau tugas apa saja yang ada untuk menampilkan "Missing" jika belum dikerjakan
        const modulesPromises = user.daftarKelas.map(async (classId) => {
             const q = query(
                 collection(db, "modules"), 
                 where("classId", "==", classId),
                 where("type", "==", "assignment"),
                 where("status", "==", "published")
             );
             const snap = await getDocs(q);
             return snap.docs.map(d => ({ id: d.id, ...d.data(), classId }));
        });
        const allModules = (await Promise.all(modulesPromises)).flat();

        // 3. Ambil Submissions (Jawaban User)
        const qSub = query(collection(db, "submissions"), where("studentId", "==", user.uid));
        const subSnap = await getDocs(qSub);
        const mySubmissions = subSnap.docs.map(d => ({ ...d.data() as any, id: d.id }));

        // 4. Merge Data (Modules + Submissions)
        const mergedData: GradeItem[] = allModules.map((module: any) => {
            const submission = mySubmissions.find(s => s.assignmentId === module.id);
            
            let status: GradeItem["status"] = "ON_GOING";
            if (submission) {
                status = submission.status || "SUBMITTED";
            } else {
                // Cek deadline untuk status MISSING
                if (module.dueDate && new Date(module.dueDate) < new Date()) {
                    status = "MISSING";
                }
            }

            // Formatting Dates
            const formatDate = (date: any) => {
                if (!date) return null;
                // Handle Firestore Timestamp or String
                const d = date.toDate ? date.toDate() : new Date(date);
                return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            return {
                id: module.id,
                assignmentTitle: module.title,
                classId: module.classId,
                className: classMap[module.classId] || "Unknown Class",
                score: submission?.score ?? null,
                maxPoints: module.points || 100,
                status: status,
                submittedAt: submission ? formatDate(submission.submittedAt) : null,
                deadline: formatDate(module.dueDate),
                feedback: submission?.feedback || null
            };
        });

        // Sort: Graded first, then Submitted, then others. Within group by date.
        mergedData.sort((a, b) => {
            if (a.status === "GRADED" && b.status !== "GRADED") return -1;
            if (a.status !== "GRADED" && b.status === "GRADED") return 1;
            return 0; // Bisa tambahkan sort by date detail di sini
        });

        setGrades(mergedData);

      } catch (error) {
        console.error("Error fetching grades:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (!userLoading) {
        if (!user) router.push("/login");
        else fetchData();
    }
  }, [user, userLoading, router]);


  // FILTERING LOGIC
  const filteredGrades = grades.filter(grade => {
      const matchFilter = activeFilter === "Semua" ? true : grade.className === activeFilter;
      const matchSearch = grade.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
  });


  // Helper Style Tab Filter (Sama seperti request sebelumnya)
  const getFilterStyle = (index: number, isActive: boolean) => {
    if (index === 0) { // Tombol Semua
        return isActive 
            ? "bg-gray-900 text-white shadow-md border-transparent" 
            : "bg-white text-gray-600 hover:bg-gray-50 border border-transparent";
    }
    const colorPattern = (index - 1) % 3;
    let style = "shadow-sm border-2 transition-all duration-200 ";
    
    if (colorPattern === 0) style += isActive ? "bg-white text-blue-600 border-blue-600" : "bg-white text-blue-600 border-transparent hover:shadow-md";
    else if (colorPattern === 1) style += isActive ? "bg-yellow-400 text-black border-yellow-600" : "bg-yellow-400 text-black border-transparent hover:shadow-md";
    else style += isActive ? "bg-purple-600 text-white border-purple-800" : "bg-purple-600 text-white border-transparent hover:shadow-md";
    
    return style;
  };

  if (userLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FC]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 font-medium animate-pulse">Memuat laporan nilai...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] w-full pb-20">
      {/* 1. HEADER SECTION */}
      <div className="px-6 md:px-12 pt-10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 bg-clip-text text-transparent leading-tight py-2">
              My Grade Report
            </h1>
            <p className="text-gray-500">Pantau perkembangan nilai dan feedback tugasmu.</p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-[400px]">
              <Input 
                placeholder="Cari Tugas..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-6 rounded-full bg-white shadow-sm border-gray-100 text-sm w-full focus-visible:ring-blue-600 transition-shadow focus:shadow-md"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2. FILTER TABS */}
        <div className="mt-8 flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {classFilters.map((filter, index) => (
            <button
              key={`${filter}-${index}`}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap",
                getFilterStyle(index, activeFilter === filter)
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CONTENT LIST */}
      <div className="px-6 md:px-12 py-2 space-y-5 max-w-7xl">
        {filteredGrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[30px] border border-dashed border-gray-200">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Tidak ada data nilai untuk filter ini.</p>
          </div>
        ) : (
          filteredGrades.map((grade) => (
            <GradeCard key={grade.id} grade={grade} />
          ))
        )}
      </div>
    </div>
  );
}