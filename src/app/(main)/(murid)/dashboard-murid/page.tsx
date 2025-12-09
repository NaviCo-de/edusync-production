'use client';

import { useUserProfile } from '@/lib/hooks/useUserProfile';

export default function DashboardMurid() {
  // Panggil hook sakti kita
  const { user, loading, error } = useUserProfile();

  // 1. Handle Loading (Wajib ada biar gak error 'cannot read property of null')
  if (loading) {
    return <div className="p-10">Sedang memuat data murid...</div>;
  }

  // 2. Handle Error atau User Kosong (Proteksi)
  if (error) return <div className="text-red-500">{error}</div>;
  if (!user) return <div>Anda belum login.</div>;

  // 3. Render UI Utama
  return (
    <div className="px-20">
      <header className="mb-8">
        <h1 
          className="text-sh2 font-bold w-fit
                    bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                    bg-clip-text text-transparent"
          >
          Welcome Again, {user.nama}!
        </h1>
        <p className="text-gray-600">
          Email: {user.email} | Status: {user.role}
        </p>
      </header>

      {/* Contoh menampilkan kartu kelas */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Kelas Saya</h2>
        
        {user.daftarKelas && user.daftarKelas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Nanti di sini kita map array enrolledClassIds buat fetch data kelas */}
             <div className="p-4 border rounded shadow">
                Kelas ID: {user.daftarKelas[0]}
             </div>
          </div>
        ) : (
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
            Kamu belum bergabung ke kelas manapun. Masukkan kode kelas dari guru!
          </div>
        )}
      </section>
    </div>
  );
}