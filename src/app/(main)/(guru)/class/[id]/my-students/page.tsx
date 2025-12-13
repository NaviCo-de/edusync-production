"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// UI Components (Pakai library standar HTML + Tailwind biar gak ribet dependency)
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"; // Pastikan kamu punya shadcn table, kalau gak ada, pakai div biasa
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Asumsi pakai shadcn avatar
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, User, MoreVertical, Trash2 } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Definisi Tipe Data Murid (Blueprint)
interface Student {
  id: string; // ID dokumen (biasanya UID user)
  nama: string;
  email: string;
  photoUrl?: string; // Optional
  joinedAt?: any; // Timestamp
}

export default function ClassStudentsPage() {
  const { id } = useParams() as { id: string };
  
  // State: Tempat penyimpanan sementara di memori browser
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // FUNGSI 1: Ambil Data (Fetching)
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Logika Kritis:
        // Kita tidak mengambil data dari collection 'users' langsung,
        // melainkan dari sub-collection 'students' di dalam dokumen kelas spesifik.
        // Path: classes -> [classID] -> students
        
        // Cek dulu apakah referensi collection ini benar sesuai databasemu
        const studentsRef = collection(db, "classes", id, "students");
        const snapshot = await getDocs(studentsRef);

        const studentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Student[];

        setStudents(studentsData);
      } catch (error) {
        console.error("Gagal mengambil data murid:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchStudents();
  }, [id]);

  // FUNGSI 2: Filter Pencarian (Client Side)
  // Analogi: Menyaring pasir (data) dengan ayakan (query)
  const filteredStudents = students.filter((student) => 
    student.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading State UI
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Sedang membuka buku absensi...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daftar Murid</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total {students.length} murid bergabung di kelas ini
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
                placeholder="Cari nama atau email..." 
                className="pl-9 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {filteredStudents.length > 0 ? (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                  {/* Avatar Cell */}
                  <TableCell>
                    <Avatar className="h-10 w-10 border border-gray-200">
                      <AvatarImage src={student.photoUrl} alt={student.nama} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                        {student.nama.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  
                  {/* Name Cell */}
                  <TableCell>
                    <div className="font-medium text-gray-900">{student.nama}</div>
                    <div className="text-xs text-gray-500 md:hidden">{student.email}</div>
                  </TableCell>
                  
                  {/* Email Cell */}
                  <TableCell className="hidden md:table-cell text-gray-600">
                    <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {student.email}
                    </div>
                  </TableCell>

                  {/* Action Cell */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Keluarkan Murid
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          // EMPTY STATE (Kalau belum ada murid atau hasil search nihil)
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
                <User className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Tidak ada murid ditemukan</h3>
            <p className="text-gray-500 max-w-sm mt-1">
               {searchQuery 
                 ? "Coba gunakan kata kunci pencarian yang lain." 
                 : "Bagikan kode kelas kepada murid agar mereka bisa bergabung."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}