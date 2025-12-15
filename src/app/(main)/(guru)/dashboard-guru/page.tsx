'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  studentCount: number;
}

export default function DashboardGuru() { 
  const router = useRouter();
  const { user, loading, error } = useUserProfile();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

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

  if (loading) return <div className="p-10">Sedang memuat data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!user) return <div>Anda belum login.</div>;

  return (
    <div className="px-8 flex flex-col items-center min-h-screen py-10">
      
      {/* Header */}
      <header className="mb-10 text-center relative w-full max-w-7xl">
        <div className="text-sh2 font-bold w-fit mx-auto
                      bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                      bg-clip-text text-transparent">
          <h1>Good Morning,</h1>
          <p>Prof. {user.nama}!</p>
        </div>
      </header>

      <div className='flex flex-col gap-10 w-full max-w-7xl'>
        <div className='flex justify-between items-center'>
          <h1 className='text-sh3 font-semibold'>Kelas Anda</h1>
          {/* Button "+ Kelas Baru" DIHAPUS - Sekarang di Settings Dropdown */}
        </div>

        {/* GRID KELAS */}
        {classes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
            {classes.map((cls) => (
              <div 
                key={cls.id} 
                onClick={() => router.push(`/manage-class/${cls.id}`)}
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
          <div className="text-center mt-10 border-2 border-dashed rounded-[20px] w-full py-12">
            <div className="w-24 h-24 bg-gray-50 rounded-full mx-auto flex items-center justify-center text-4xl mb-4">
              📚
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Belum ada kelas</h3>
            <p className="text-gray-500 max-w-sm mt-2 mb-6 mx-auto">
              Mulai mengajar dengan membuat kelas pertama Anda melalui menu Settings.
            </p>
            <p className="text-sm text-gray-400">
              Klik "Settings" → "+ Buat Kelas Baru"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}