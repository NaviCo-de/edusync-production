"use client";

import { CustomIcon } from "@/components/ui/CustomIcon";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; 
import { format } from "date-fns"; 

// Interface Data Kelas (Read Only)
interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  teacherId: string;
  teacherName?: string;
}

// Interface Announcement (Read Only)
interface Announcement {
  id: string;
  title: string;
  content: string;
  fileUrl?: string;  
  fileName?: string;  
  createdAt: any; 
}

export default function StudentClassDetail() {
  const { id } = useParams(); 
  const router = useRouter();
  
  // Data State
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); 
  const [loading, setLoading] = useState(true);

  // 1. Fetch Detail Kelas
  useEffect(() => {
    const fetchClassDetail = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "classes", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as ClassData;
          setClassData(data);
        } else {
          // Jika kelas tidak ditemukan, kembalikan ke dashboard
          router.push("/dashboard-murid");
        }
      } catch (error) {
        console.error("Error fetching class:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClassDetail();
  }, [id, router]);

  // 2. Realtime Announcements (Read Only)
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "classes", id as string, "announcements"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Announcement[];
      setAnnouncements(data);
    });
    return () => unsubscribe(); 
  }, [id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "d MMM yyyy, HH:mm");
  };

  if (loading) return <div className="p-10 text-center">Memuat kelas...</div>;
  if (!classData) return null;

  return (
    <div className="min-h-screen pb-10 mx-20 mt-11">
      {/* --- HEADER TITLE & SEARCH --- */}
      <div className="flex items-center justify-between">
        <div className="flex justify-center items-center">
          <Link href={"/dashboard-murid"}>
            <Image 
              src={"/back_class_detail.png"}
              alt="Back"
              width={500}
              height={500}
              className="w-30 h-30 cursor-pointer hover:opacity-80 transition"
            />
          </Link>
          <div>
            <p className="text-sh1 font-semibold bg-linear-to-r from-blue-20 via-blue-40 to-blue-base bg-clip-text text-transparent">
                {classData.name}
            </p>
            {/* Menampilkan nama guru agar murid tahu ini kelas siapa */}
            <p className="text-sm text-gray-500 font-medium ml-1">
                Teacher: {classData.teacherName || "Guru"}
            </p>
          </div>
        </div>
        <div>
          <Input
            placeholder="Search Material"
            className="w-157 h-14 px-5 py-4 rounded-4xl text-b7 placeholder:text-b7 font-normal bg-white shadow-[0_0_15px_rgba(0,0,0,0.10)]"
            icon={<CustomIcon src={"/search.png"} className="w-6 h-6"/>}
          />
        </div>
      </div>

      {/* --- CLASS INFO (READ ONLY) --- */}
      <div className="flex flex-col gap-5 mt-5">
          <p className="text-sh3 font-semibold text-black">About My Class</p>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-blue-100 font-regular text-b6 text-justify leading-relaxed">
                {classData.description || "Belum ada deskripsi kelas."}
            </p>
          </div>
          {/* BAGIAN TOMBOL SHARE & EDIT DIHAPUS DISINI */}
      </div>

      {/* --- ANNOUNCEMENT SECTION (READ ONLY) --- */}
      <div className="mt-10">
        <div className="flex justify-between items-center mb-5">
          <p className="text-sh3 font-semibold text-black">My Announcement</p>
          {/* TOMBOL MAKE ANNOUNCEMENT DIHAPUS DISINI */}
        </div>

        {/* --- LIST ANNOUNCEMENTS --- */}
        <div>
          {announcements.length > 0 ? (
                announcements.map((item) => (
                  <div key={item.id} className="bg-addition-blue-30 p-6 rounded-[12px] mb-4">
                    
                    {/* Header Postingan: Avatar Guru & Tanggal */}
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">
                                {classData.teacherName?.charAt(0) || "T"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-bold text-blue-900">{classData.teacherName || "Guru"}</p>
                            <p className="text-xs text-blue-400 font-medium">Published On {formatDate(item.createdAt)}</p>
                        </div>
                    </div>

                    <div className="ml-0 mt-2">
                      {/* Judul & Isi */}
                      <p className="font-semibold text-blue-100 text-sh6 mb-2">{item.title}</p>
                      <p className="text-b7 text-blue-100 whitespace-pre-wrap">{item.content}</p>
                      
                      {/* File Display (Read Only) */}
                      {item.fileUrl && (
                        <div className="flex justify-between items-center bg-white rounded-lg px-5 py-3 mt-4 border border-gray-100 shadow-sm w-full md:w-1/2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Image src={"/pdf.png"} alt="file" width={40} height={40} className="w-8 h-8 shrink-0"/>
                              <p className="text-sm font-medium text-gray-700 truncate">
                                {item.fileName || "Lampiran Dokumen"}
                              </p>
                            </div>
                            <a 
                              href={item.fileUrl} 
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <Image src={"/download.png"} alt="download" width={24} height={24} className="w-6 h-6"/>
                            </a>
                        </div>
                      )}
                    </div>

                    {/* TOMBOL EDIT/DELETE DIHAPUS DISINI */}
                  </div>
                ))
              ) : (
                 <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-xl">
                   <p className="text-gray-400 mb-2">Belum ada pengumuman dari guru.</p>
                 </div>
              )}
        </div>
      </div>
      
      <div className="h-10"></div>
    </div>
  );
}