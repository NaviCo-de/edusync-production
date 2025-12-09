'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Kita butuh ini buat ambil data role
import { auth, db } from '@/lib/firebase';

export default function RootPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'LOADING' | 'CHECKING_ROLE' | 'IDLE'>('LOADING');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // 1. Gak login? Tendang ke login page
        console.log("User tamu -> Redirect Login");
        router.push('/login');
        return;
      }

      // 2. Sudah login? Jangan seneng dulu. Cek dia siapa.
      setStatus('CHECKING_ROLE');
      
      try {
        // Ambil dokumen user dari Firestore berdasarkan UID
        const userDocRef = doc(db, 'users', user.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          const role = userData.role; // Pastikan field di DB namanya 'role'

          // 3. Logic Persimpangan Jalan (Router)
          if (role === 'GURU') {
            console.log("Role Guru terdeteksi -> Masuk Dashboard Guru");
            router.push('/dashboard-guru');
          } else if (role === 'MURID') {
            console.log("Role Murid terdeteksi -> Masuk Dashboard Murid");
            router.push('/dashboard-murid');
          } else {
            // Kasus Kritis: User login tapi gak punya role (Data korup/User baru)
            console.error("User tidak memiliki role yang valid!");
            // Opsional: Lempar ke halaman error atau setup profile
             alert("Akun Anda bermasalah. Hubungi Admin.");
          }
        } else {
          console.error("Dokumen user tidak ditemukan di database!");
        }
      } catch (error) {
        console.error("Gagal mengambil data user:", error);
      } finally {
        setStatus('IDLE');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Tampilan Loading (Penting biar user gak bingung)
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 gap-4">
      {/* Spinner sederhana */}
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      
      <p className="text-gray-600 font-medium">
        {status === 'LOADING' && "Memeriksa status login..."}
        {status === 'CHECKING_ROLE' && "Mengambil data profil..."}
        {status === 'IDLE' && "Mengalihkan..."}
      </p>
    </div>
  );
}