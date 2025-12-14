'use client';

import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateClassCode } from "@/lib/utils"; 
import ClassImageUpload from '../components/ClassImageUpload';
import { useRouter } from 'next/navigation'; // [BARU] Import router

// Import komponen Shadcn
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  studentCount: number;
}

export default function DashboardGuru() { 
  const router = useRouter(); // [BARU] Init router
  const { user, loading, error } = useUserProfile();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Dialog State
  const [open, setOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [classImage, setClassImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const classList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClassData));

      setClasses(classList);
    } catch (err) {
      console.error("Gagal mengambil data kelas:", err);
    } finally {
      setLoadingClasses(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreateClass = async () => {
    if (!className) return alert("Nama kelas wajib diisi!");
    if (!classImage) return alert("Upload logo kelas dulu!");
    if (!user) return alert("User tidak ditemukan");

    setIsSubmitting(true);

    try {
      const code = generateClassCode();

      await addDoc(collection(db, "classes"), {
        name: className,
        imageUrl: classImage,
        teacherId: user.uid,
        teacherName: user.nama,
        code: code,
        studentCount: 0,
        description: "Belum ada deskripsi kelas.",
        createdAt: serverTimestamp(),
      });

      alert(`Kelas berhasil dibuat! Kode: ${code}`);
      setOpen(false);
      setClassName("");
      setClassImage("");
      fetchClasses(); 
      
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Gagal membuat kelas. Cek console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-10">Sedang memuat data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!user) return <div>Anda belum login.</div>;

  return (
    <div className="px-8 flex flex-col items-center min-h-screen py-10">
      
      {/* Header */}
      <header className="mb-10 text-center relative w-full max-w-7xl"> {/* [EDIT] max-w dilebarkan */}
        <div className="text-sh2 font-bold w-fit mx-auto
                      bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                      bg-clip-text text-transparent">
          <h1>Good Morning,</h1>
          <p>Prof. {user.nama}!</p>
        </div>
      </header>

      {/* Dialog Create Class */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Buat Kelas Baru</DialogTitle>
            <DialogDescription>
              Isi data kelas. Kode kelas akan digenerate otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Kelas</Label>
              <Input
                id="name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Contoh: Matematika X-2"
              />
            </div>
            <ClassImageUpload onUploadComplete={(url) => setClassImage(url)} />
          </div>
          <DialogFooter>
            <Button 
              onClick={handleCreateClass} 
              disabled={isSubmitting}
              className="rounded-[20px] px-5 py-4 text-b7 text-white font-semibold w-fit h-fit bg-blue-base"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Kelas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className='flex flex-col gap-10'>
        <div className='flex justify-between items-center'>
          <h1 className='text-sh3 font-semibold'>Kelas Anda</h1>
          {classes.length > 0 && (
            <Button 
              onClick={() => setOpen(true)} 
              className="rounded-[20px] px-8 py-4 text-b7 text-white font-semibold w-fit h-fit bg-blue-base"
            >
              + Kelas Baru
            </Button>
          )}
        </div>
        {/* GRID KELAS */}
        {classes.length > 0 ? (
          // [EDIT PENTING] logic grid disini: xl:grid-cols-4 (Layar besar = 4 kolom)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-7xl">
            {classes.map((cls) => (
              <div 
                key={cls.id} 
                // [BARU] Fungsi klik pindah halaman
                onClick={() => router.push(`/class/${cls.id}`)}
                className="rounded-[12px] px-7 py-8 shadow-sm hover:shadow-md hover:scale-105 transition-all bg-white group cursor-pointer relative overflow-hidden flex flex-col gap-9"
              >
                <h3 className="text-sh3 font-semibold text-blue-base transition-colors line-clamp-1">
                  {cls.name}
                </h3>
                <div className="flex justify-center items-center mb-4">
                  {cls.imageUrl && (
                    <img src={cls.imageUrl} alt="Logo" className="w-20 h-20 rounded-[12px] object-cover border" />
                  )}
                </div>
                
              </div>
            ))}
          </div>
        ) : (
          // Tampilan Kosong (Empty State)
          <div className="text-center mt-10 border-2 border-dashed rounded-[20px] w-full py-4">
            <div className="w-24 h-24 bg-gray-50 rounded-full mx-auto flex items-center justify-center text-4xl">
              📚
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Belum ada kelas</h3>
            <p className="text-gray-500 max-w-sm mt-2 mb-6 mx-auto">
              Mulai mengajar dengan membuat kelas pertama Anda.
            </p>
            <Button 
              onClick={() => setOpen(true)} 
              variant="default"
              className="rounded-[20px] px-8 py-4 text-b7 text-white font-semibold w-fit h-fit bg-blue-base"
            >
              Buat Kelas Sekarang
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}