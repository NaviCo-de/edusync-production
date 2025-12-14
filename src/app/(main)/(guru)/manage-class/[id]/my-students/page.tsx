"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Bell, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Definisi Tipe Data Murid
interface Student {
  id: string;
  nama: string;
  nis?: string;
  photoURL?: string;
  email?: string;
  joinedAt?: any;
}

export default function MyStudentsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Students dari subcollection
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Path: classes -> [classID] -> students
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

  // Filter Pencarian
  const filteredStudents = students.filter((student) => 
    student.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.nis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fungsi untuk kick/remove student dari class
  const handleKickStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengeluarkan ${studentName} dari kelas?`)) {
      return;
    }

    try {
      // 1. Hapus dari subcollection students di class
      await deleteDoc(doc(db, "classes", id, "students", studentId));
      
      // 2. Hapus classId dari array daftarKelas di user document
      const userRef = doc(db, "users", studentId);
      await updateDoc(userRef, {
        daftarKelas: arrayRemove(id)
      });
      
      // 3. Update state untuk remove dari UI
      setStudents(prevStudents => prevStudents.filter(s => s.id !== studentId));      
    } catch (error) {
      console.error("Error removing student:", error);
      alert("Gagal mengeluarkan student. Silakan coba lagi.");
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6FB]">
        <p className="text-gray-400 animate-pulse">Loading students...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <div className="mx-20 px-8 py-8">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-sh1 font-semibold 
                        bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                        bg-clip-text text-transparent"
          >
            My Students
          </h1>
          
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative w-[400px]">
              <Input 
                placeholder="Search" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-5 pr-12 rounded-full bg-white border-none shadow-sm text-sm"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            
            {/* Bell Icon */}
            <button className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Bell className="h-5 w-5 text-[#6C63FF]" />
            </button>
          </div>
        </div>

        {/* SCORE RECAP SECTION - Hardcoded */}
        <div className="mb-12">
          <h2 className="text-[32px] font-bold text-black mb-6">Score Recap</h2>
          
          <div className="bg-white rounded-[20px] p-8 shadow-sm flex justify-between items-center">
            {/* Left Info */}
            <div>
              <h3 className="text-[24px] font-bold text-black mb-2">
                TK2 Kalkulus 1:<br />Penerapan Integral
              </h3>
              <div className="flex items-center gap-8 mt-4">
                <div>
                  <p className="text-[#6C63FF] text-sm font-semibold">Total Submission</p>
                  <p className="text-[#6C63FF] text-2xl font-bold mt-1">3 Students</p>
                </div>
              </div>
              <Button 
                className="mt-6 bg-[#6C63FF] hover:bg-[#5A52E0] text-white rounded-full px-8 py-3 font-semibold"
                onClick={() => {/* Navigate to review page */}}
              >
                See The Review
              </Button>
            </div>

            {/* Right Diagram Placeholder */}
            <div className="w-[600px] h-[300px] bg-gray-100 rounded-xl flex items-center justify-center">
              <span className="text-gray-400 text-sm font-medium">FRAME DIAGRAM</span>
            </div>
          </div>
        </div>

        {/* LIST OF STUDENTS SECTION */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[32px] font-bold text-black">List of Student</h2>
          <span className="text-[20px] font-bold text-[#B8A229]">
            {filteredStudents.length} Students
          </span>
        </div>

        {/* Students Grid - 2 Columns */}
        {filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredStudents.map((student) => (
              <div 
                key={student.id}
                className="bg-white rounded-[20px] p-6 shadow-sm flex items-center justify-between"
              >
                {/* Left: Avatar + Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-gray-100">
                    <AvatarImage src={student.photoURL} alt={student.nama} />
                    <AvatarFallback className="bg-[#E8E7FF] text-[#6C63FF] font-bold text-lg">
                      {student.nama?.charAt(0).toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="text-[18px] font-bold text-[#B8A229]">
                      {student.nama || "No Name"}
                    </h3>
                    <p className="text-[14px] text-gray-600 mt-1">
                      {student.nis || "No Student ID"}
                    </p>
                  </div>
                </div>

                {/* Right: Buttons */}
                <div className="flex items-center gap-3">
                  <Button 
                    className="bg-[#FFD54F] hover:bg-[#E5C04A] text-[#5A4F14] rounded-full px-6 py-2 font-bold text-sm"
                    onClick={() => router.push(`/profile/${student.id}`)}
                  >
                    Visit Profile
                  </Button>
                  
                  <button
                    className="h-12 w-12 rounded-xl bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center group"
                    onClick={() => {handleKickStudent(student.id, student.nama)}}
                    title="Remove Student"
                  >
                    <img 
                      src="/kick.png" 
                      alt="Kick Student" 
                      className="h-6 w-6 opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="bg-white rounded-[20px] p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <span className="text-3xl">👥</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Students Found</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchQuery 
                ? "Try using different search keywords." 
                : "Share the class code with students so they can join."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}