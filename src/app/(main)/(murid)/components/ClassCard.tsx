"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton"; // Kalau ada shadcn skeleton

export function ClassCard({ classId }: { classId: string }) {
  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClassDetail = async () => {
      try {
        const docRef = doc(db, "classes", classId); // Pastikan collectionnya "classes"
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setClassData(docSnap.data());
        } else {
          setClassData({ title: "Kelas Tidak Ditemukan" });
        }
      } catch (error) {
        console.error("Gagal ambil data kelas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetail();
  }, [classId]);

  // Tampilan Loading (Skeleton)
  if (loading) {
    return (
      <div className="p-6 border rounded-xl bg-gray-50 h-40 animate-pulse">
        <div className="h-10 w-10 bg-gray-200 rounded-full mb-4"></div>
        <div className="h-6 w-3/4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Jika kelas tidak ditemukan / error
  if (!classData) return null;

  return (
    <div 
      className="group relative p-6 border rounded-xl bg-white shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500 hover:-translate-y-1"
      onClick={() => window.location.href = `/class/${classId}`} // Redirect simpel
    >
      <div className="flex items-center justify-between mb-4">
        <div className="bg-blue-50 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <BookOpen className="h-6 w-6" />
        </div>
        {/* Menampilkan Kode Kelas di pojok kanan (opsional) */}
        <span className="text-xs font-mono font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">
          {classData.code || "CODE"}
        </span>
      </div>
      
      {/* INI YANG KAMU CARI: JUDUL KELAS */}
      <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">
        {classData.name || "Tanpa Judul"}
      </h3>
      
      <p className="text-sm text-gray-500 line-clamp-2">
        {classData.description || "Klik untuk masuk dan melihat materi."}
      </p>
    </div>
  );
}