// hooks/useUserProfile.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Definisikan Tipe Data Murid biar autocomplete jalan
// Sesuaikan field ini dengan apa yang ada di Firestore kamu!
export interface UserProfile {
  uid: string;
  email: string;
  nama: string;
  role: 'MURID' | 'GURU';
  telepon: string;
  daftarKelas?: string[];
}

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // 1. Ambil referensi dokumen user di Firestore
          const userDocRef = doc(db, 'users', authUser.uid);
          const userSnapshot = await getDoc(userDocRef);

          if (userSnapshot.exists()) {
            // 2. Simpan data ke state
            setUser({
              uid: authUser.uid,
              ...userSnapshot.data(), // Spread data dari firestore (nama, role, dll)
            } as UserProfile);
          } else {
            setError("Data user tidak ditemukan di database.");
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setError("Gagal mengambil data profil.");
        }
      } else {
        // Kalau gak login/logout, kosongkan state
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
}