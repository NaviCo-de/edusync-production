"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  teacherId: string;
  studentCount: number;
  studentIds: string[];
}

export default function ClassDetail() {
  const { id } = useParams(); // Tangkap ID dari URL
  const router = useRouter();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stream' | 'people'>('stream');

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

  const copyToClipboard = () => {
    if (classData?.code) {
      navigator.clipboard.writeText(classData.code);
      alert("Kode kelas disalin!");
    }
  };

  if (loading) return <div className="p-10 text-center">Memuat kelas...</div>;
  if (!classData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* 1. HEADER AREA */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* Gambar Kelas */}
            <div className="w-full md:w-48 h-32 shrink-0 rounded-lg overflow-hidden border bg-gray-100">
               {classData.imageUrl ? (
                 <img src={classData.imageUrl} alt="Class Logo" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
               )}
            </div>

            {/* Info Kelas */}
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">{classData.name}</h1>
              <p className="text-gray-500">{classData.description || "Tidak ada deskripsi untuk kelas ini."}</p>
              
              <div className="flex items-center gap-4 mt-4 pt-2">
                 {/* Badge Kode Kelas */}
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

            {/* Tombol Aksi (Optional) */}
            <div className="flex gap-2">
               <Button variant="outline" onClick={() => router.push('/dashboard-guru')}>Kembali</Button>
               <Button variant="destructive">Hapus Kelas</Button>
            </div>
          </div>
        </div>

        {/* 2. NAVIGATION TABS */}
        <div className="max-w-5xl mx-auto px-6 mt-4 flex gap-6 text-sm font-medium text-gray-500">
          <button 
            onClick={() => setActiveTab('stream')}
            className={`pb-3 border-b-2 px-1 ${activeTab === 'stream' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-gray-700'}`}
          >
            Forum & Materi
          </button>
          <button 
             onClick={() => setActiveTab('people')}
             className={`pb-3 border-b-2 px-1 ${activeTab === 'people' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-gray-700'}`}
          >
            Anggota Kelas
          </button>
        </div>
      </div>

      {/* 3. CONTENT AREA */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* KONTEN TAB: STREAM */}
        {activeTab === 'stream' && (
          <div className="space-y-6">
            {/* Input Fake */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">👤</div>
               <p className="text-gray-400 text-sm">Umumkan sesuatu ke kelas anda...</p>
            </div>

            {/* Empty State Materi */}
            <div className="text-center py-10 border-2 border-dashed rounded-xl">
               <p className="text-gray-400 mb-2">Belum ada postingan materi atau tugas.</p>
               <Button>+ Buat Materi Baru</Button>
            </div>
          </div>
        )}

        {/* KONTEN TAB: PEOPLE */}
        {activeTab === 'people' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700">Daftar Murid</h3>
              <span className="text-xs bg-white px-2 py-1 border rounded">{classData.studentCount} Siswa</span>
            </div>
            
            <div className="divide-y">
               {/* Contoh list statis dulu (nanti bisa difetch dari user IDs) */}
               {classData.studentIds.length > 0 ? (
                 classData.studentIds.map((sid, idx) => (
                   <div key={idx} className="p-4 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                       M
                     </div>
                     <div>
                       <p className="text-sm font-medium text-gray-900">ID Murid: {sid}</p>
                       <p className="text-xs text-gray-500">Bergabung pada 12 Des 2025</p>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="p-8 text-center text-gray-400">
                   Belum ada murid yang bergabung. <br/>
                   Share kode <strong>{classData.code}</strong> ke murid anda.
                 </div>
               )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}