"use client";

import { useEffect, useState } from "react";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getStudentGrades, StudentGrade } from "@/lib/services/gradeService";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- KOMPONEN KECIL UNTUK UI YANG BERSIH ---

const ScoreBox = ({ score }: { score: number | null }) => {
  if (score === null) return (
    <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] bg-gray-100 rounded-[20px] flex flex-col justify-center items-center shrink-0">
      <span className="text-gray-400 text-xs font-bold">Pending</span>
    </div>
  );

  // Warna dinamis berdasarkan nilai
  const isGood = score >= 75;
  
  return (
    <div className={cn(
      "w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-[20px] flex flex-col justify-center items-center shrink-0 transition-all",
      isGood ? "bg-addition-blue-30 text-blue-base" : "bg-red-50 text-red-500"
    )}>
      <span className="text-3xl md:text-4xl font-bold tracking-tighter">{score}</span>
      <span className="text-xs font-semibold mt-1">Score</span>
    </div>
  );
};

const GradeCard = ({ grade }: { grade: StudentGrade }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-gray-100 hover:shadow-md transition-all duration-300">
      {/* HEADER KARTU (Selalu Terlihat) */}
      <div 
        className="flex items-start gap-4 md:gap-6 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* KIRI: Kotak Nilai */}
        <ScoreBox score={grade.score} />

        {/* TENGAH: Informasi Utama */}
        <div className="flex-1 pt-1">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 line-clamp-1">
            {grade.question}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Deadline on 18 Nov 2025 - 23:59
          </p>
          
          {/* Preview Feedback (Muncul saat ditutup) */}
          {!isOpen && grade.feedback_summary && (
            <p className="text-sm text-gray-400 mt-3 line-clamp-2">
              <span className="text-blue-base font-semibold">Feedback: </span>
              {grade.feedback_summary}
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
              <p className="font-semibold text-gray-800 mb-2">
                Feedback by <span className="text-blue-base">Lynx AI</span>
              </p>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                {grade.feedback_summary || "Belum ada feedback detail untuk tugas ini."}
              </p>
            </div>

            {/* Table Info */}
            <div className="bg-gray-50 rounded-xl p-4 md:px-8 md:py-6">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-3">
                <span className="font-bold text-gray-900 text-sm">Grading Status</span>
                <span className={cn(
                  "font-medium text-sm px-3 py-1 rounded-full",
                  grade.status === "GRADED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                )}>
                  {grade.status === "GRADED" ? "Graded" : "On Progress"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 text-sm">Finished On</span>
                <span className="text-gray-600 text-sm">{grade.submitted_at}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// --- HALAMAN UTAMA ---

export default function MyGradesPage() {
  const { user, loading: userLoading } = useUserProfile();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [classNames, setClassNames] = useState<string[]>([]); // State untuk menyimpan nama kelas asli
  
  const router = useRouter();

  // 1. Fetch Grade Data
  useEffect(() => {
    const fetchData = async () => {
      if (user?.uid) {
        setLoadingData(true);
        const data = await getStudentGrades(user.uid);
        setGrades(data);
        setLoadingData(false);
      }
    };

    if (!userLoading) {
      if (!user) {
        router.push("/login");
      } else {
        fetchData();
      }
    }
  }, [user, userLoading, router]);

  // 2. Fetch Class Names from 'classes' collection based on user.daftarKelas IDs
  useEffect(() => {
    const fetchClassNames = async () => {
      if (user?.daftarKelas && user.daftarKelas.length > 0) {
        try {
          // Ambil semua dokumen kelas secara paralel
          const classPromises = user.daftarKelas.map(async (classId) => {
            const classDocRef = doc(db, "classes", classId);
            const classSnap = await getDoc(classDocRef);
            if (classSnap.exists()) {
              // Ambil field nama, sesuaikan dengan field di DB kamu (misal: 'nama', 'name', 'mata_kuliah')
              const data = classSnap.data();
              return data.nama || data.name || data.subject || "Kelas Tanpa Nama";
            }
            return "Unknown Class";
          });

          const names = await Promise.all(classPromises);
          setClassNames(names);
        } catch (error) {
          console.error("Gagal mengambil data kelas:", error);
        }
      }
    };

    if (user) {
      fetchClassNames();
    }
  }, [user]);

  // Gabungkan "Semua" dengan nama kelas yang berhasil diambil
  const filters = ["Semua", ...classNames];

  // Logic Warna Berulang (Pattern 3 Warna) sesuai request
  const getFilterStyle = (index: number, isActive: boolean) => {
    // Pattern index (skip "Semua" di index 0 agar pola warna mulai dari kelas pertama)
    const patternIndex = index - 1; 
    
    // Style khusus tombol "Semua"
    if (index === 0) { 
        return isActive 
            ? "bg-gray-900 text-white shadow-md border-transparent" 
            : "bg-white text-gray-600 hover:bg-gray-50 border border-transparent";
    }

    // Pola 3 Warna untuk Kelas (0, 1, 2, 0, 1, 2...)
    const colorPattern = patternIndex % 3;

    // Base styles
    let style = "shadow-sm border-2 transition-all duration-200";

    // 1. Putih Biru (Matematika Diskret style)
    if (colorPattern === 0) {
        style += isActive 
            ? " bg-white text-blue-base border-blue-base" 
            : " bg-white text-blue-base border-transparent hover:shadow-md";
    }
    // 2. Kuning Hitam (Kalkulus style)
    else if (colorPattern === 1) {
        style += isActive 
            ? " bg-yellow-base text-black border-yellow-600" 
            : " bg-yellow-base text-black border-transparent hover:shadow-md";
    }
    // 3. Ungu Putih (Pemrograman style)
    else {
        style += isActive 
            ? " bg-[#8B5CF6] text-white border-[#7C3AED]" 
            : " bg-[#8B5CF6] text-white border-transparent hover:shadow-md";
    }
    
    return style;
  };

  if (userLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FC]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 font-medium animate-pulse">Memuat nilai...</p>
        </div>
      </div>
    );
  }

  // Filter Logic Sederhana (Client Side)
  const filteredGrades = activeFilter === "Semua" 
    ? grades 
    : grades; // Note: Filtering actual akan butuh field 'className' di grades, saat ini menampilkan semua.

  return (
    <div className="min-h-screen bg-[#F8F9FC] w-full pb-20">
      {/* 1. HEADER SECTION */}
      <div className="px-6 md:px-12 pt-10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Title dengan Gradasi & Hapus Subtitle Kecil */}
          <div>
            <h1 className="text-3xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight py-2">
              Let&rsquo;s See Your Progress Here!
            </h1>
          </div>

          {/* Search & Notif */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search bar dipanjangkan (w-full pada mobile, fixed lebar pada desktop) */}
            <div className="relative flex-1 md:w-[600px]">
              <Input 
                placeholder="Cari Materi atau Tugas" 
                className="pl-6 pr-10 py-6 rounded-full bg-white shadow-sm border-gray-100 text-sm w-full focus-visible:ring-blue-base transition-shadow focus:shadow-md"
              />
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
            <button className="w-12 h-12 bg-white border border-gray-100 rounded-full flex items-center justify-center text-blue-base shrink-0 hover:bg-blue-50 transition shadow-sm">
              <Bell className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 2. FILTER TABS (Dynamic Colors dari DB) */}
        <div className="mt-10 flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {filters.map((filter, index) => (
            <button
              key={`${filter}-${index}`}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap",
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
          <div className="text-center py-20">
            <p className="text-gray-400">Belum ada tugas yang dikumpulkan.</p>
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