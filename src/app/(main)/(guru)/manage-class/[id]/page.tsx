"use client";

import { CustomIcon } from "@/components/ui/CustomIcon";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp ,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import { useUserProfile } from "@/lib/hooks/useUserProfile"; 
import { format } from "date-fns"; 
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";

// [UPDATE] Interface Data Kelas: Tambah teacherName
interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  teacherId: string;
  teacherName?: string; // Kita ambil nama guru dari sini
  studentCount: number;
  studentIds: string[];
}

// [UPDATE] Interface Announcement: Lebih Simpel
interface Announcement {
  id: string;
  title:string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: any; 
  // Tidak ada authorName/ID lagi
}

export default function ClassDetail() {
  const { id } = useParams(); 
  const router = useRouter();
  const { user } = useUserProfile(); 
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stream' | 'people'>('stream');

  // State Form
  const [isPosting, setIsPosting] = useState(false);
  const [inputContent, setInputContent] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  const [isPostingMode, setIsPostingMode] = useState(false); // Toggle Form/Button
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null); // File mentah dari input
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [isUpdatingDesc, setIsUpdatingDesc] = useState(false);

  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");


  // 1. Fetch Detail Kelas
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

  // 2. Realtime Announcements
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

  const uploadToCloudinary = async (file: File): Promise<string> => {
     const formData = new FormData();
     formData.append("file", file);
     // Menggunakan Preset dari env (pastikan env local sudah di-set)
     formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

     try {
       // PENTING: Saya ganti /image/upload menjadi /auto/upload
       // Agar support PDF, DOCX, dan Video, bukan hanya Gambar.
       const res = await fetch(
         `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`,
         { method: "POST", body: formData }
       );
       const data = await res.json();
       
       if (data.secure_url) {
         return data.secure_url;
       } else {
         throw new Error("Respon Cloudinary tidak memiliki secure_url");
       }
     } catch (err) {
       console.error("Upload error:", err);
       throw err; // Lempar error agar proses posting berhenti
     }
  };

  

  // 3. [UPDATE] Logic Posting Lebih Simpel
  const handlePostAnnouncement = async () => {
    if (!postTitle.trim() || !postContent.trim()) {
      return alert("Judul dan Konten wajib diisi!");
    }
    
    setIsSubmitting(true);
    try {
      let uploadedUrl = "";
      
      // Jika ada file, upload dulu
      if (postFile) {
        console.log("Sedang mengupload file...");
        uploadedUrl = await uploadToCloudinary(postFile);
        console.log("Upload sukses:", uploadedUrl);
      }

      await addDoc(collection(db, "classes", id as string, "announcements"), {
        title: postTitle,
        content: postContent,
        fileUrl: uploadedUrl || null,
        fileName: postFile ? postFile.name : null,
        createdAt: serverTimestamp(),
      });

      // Reset Form
      setPostTitle("");
      setPostContent("");
      setPostFile(null);
      setIsPostingMode(false); // Tutup form
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset input file HTML

    } catch (error) {
      console.error("Gagal memposting:", error);
      alert("Gagal memposting pengumuman.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Logic DELETE Announcement
  const handleDeleteAnnouncement = async (announceId: string) => {
    if(!confirm("Yakin ingin menghapus pengumuman ini?")) return;
    try {
      await deleteDoc(doc(db, "classes", id as string, "announcements", announceId));
    } catch (error) {
      console.error("Gagal hapus:", error);
      alert("Gagal menghapus.");
    }
  };

  // 5. Logic PREPARE Update Announcement (Buka Modal Edit)
  const openEditAnnouncement = (item: Announcement) => {
    setEditingAnnouncement(item);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleUpdateAnnouncement = async () => {
    if (!editingAnnouncement || !id) return;
    
    try {
      const docRef = doc(db, "classes", id as string, "announcements", editingAnnouncement.id);
      await updateDoc(docRef, {
        title: editTitle,
        content: editContent,
        // Update timestamp edit jika mau: updatedAt: serverTimestamp()
      });
      setEditingAnnouncement(null); // Tutup modal
    } catch (error) {
      console.error("Gagal update:", error);
      alert("Gagal update pengumuman.");
    }
  };

  const handleUpdateDescription = async () => {
    if (!id) return;
    setIsUpdatingDesc(true);
    try {
      const docRef = doc(db, "classes", id as string);
      
      // Update ke Firebase
      await updateDoc(docRef, {
        description: descInput
      });

      // Update State Lokal (Agar UI langsung berubah tanpa refresh)
      setClassData((prev) => prev ? { ...prev, description: descInput } : null);
      
      setIsEditModalOpen(false); // Tutup modal
    } catch (error) {
      console.error("Gagal update deskripsi:", error);
      alert("Gagal mengubah deskripsi.");
    } finally {
      setIsUpdatingDesc(false);
    }
  };

  const openEditModal = () => {
    setDescInput(classData?.description || "");
    setIsEditModalOpen(true);
  };

  const copyToClipboard = () => {
    if (classData?.code) {
      navigator.clipboard.writeText(classData.code);
      alert("Kode kelas disalin!");
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Memposting...";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "d MMM yyyy, HH:mm");
  };

  if (loading) return <div className="p-10 text-center">Memuat kelas...</div>;
  if (!classData) return null;

  return (
    <div className="min-h-screen pb-10 mx-20 mt-11">
      <div className="flex items-center justify-between mb-12">
        <div className="flex justify-center items-center">
          <Link
            href={"/dashboard-guru"}
            className=""
          >
            <Image 
              src={"/back_class_detail.png"}
              alt="Back"
              width={500}
              height={500}
              className="w-30 h-30"
            />
          </Link>
          <p className="text-sh1 font-semibold 
                        bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                        bg-clip-text text-transparent"
          >
            {classData.name}
          </p>
        </div>
        <div>
          <Input
            placeholder="Search Material"
            className="w-157 h-14 px-5 py-4 rounded-4xl text-b7 placeholder:text-b7 font-normal bg-white shadow-[0_0_15px_rgba(0,0,0,0.10)]"
            icon={<CustomIcon 
              src={"/search.png"}
              className="w-6 h-6"
            />}
          />
        </div>
      </div>

      <div className="flex items-start mb-18 gap-10">
        <div className="flex flex-col gap-5 w-3/4">
          <p className="text-sh3 font-semibold text-black">About My Class</p>
          <p className="text-blue-100 font-regular text-b6 text-justify mb-5">{classData.description}</p>
          <div className="flex gap-4">
            <Button
              onClick={copyToClipboard}
              className="flex group bg-purple-base hover:bg-purple-10"
            >
              <CustomIcon 
                src={"/classroom_code.png"}
                className="w-5 h-5 bg-white group-hover:bg-purple-base"
              />
              <p className="text-white font-semibold group-hover:text-purple-base">Share Classroom Code</p>
            </Button>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openEditModal}
                  className="flex group bg-purple-base hover:bg-purple-10"
                >
                  <CustomIcon 
                    src={"/edit_description.png"}
                    className="w-5 h-5 bg-white group-hover:bg-purple-base"
                  />
                  <p className="text-white font-semibold group-hover:text-purple-base">Edit Description</p>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-white">
                <DialogHeader>
                  <DialogTitle>Edit Deskripsi Kelas</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Textarea
                    id="description"
                    className="col-span-3 min-h-[150px]"
                    placeholder="Tuliskan deskripsi kelas..."
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Batal
                  </Button>
                  <Button 
                    type="submit" 
                    onClick={handleUpdateDescription}
                    disabled={isUpdatingDesc}
                    className="bg-blue-base text-white hover:bg-blue-600"
                  >
                    {isUpdatingDesc ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="w-1/4">
          <p className="text-sh3 font-semibold text-black">Latest Activity</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-5">
          <p className="text-sh3 font-semibold text-black">My Announcement</p>
          {!isPostingMode && (
            <Button
              onClick={() => setIsPostingMode(true)}
              className="flex group bg-purple-base hover:bg-purple-10 px-6 py-5"
            >
                <CustomIcon src={"/plus.png"} className="w-5 h-5 bg-white group-hover:bg-purple-base"/>
                <p className="text-white text-sh6 font-semibold group-hover:text-purple-base">Make Announcement</p>
            </Button>
          )}
        </div>
        {isPostingMode && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-6 transition-all animate-in fade-in slide-in-from-top-2">
            <h3 className="font-semibold text-lg text-gray-700 mb-4">New Announcement</h3>
            
            <Input
              variant={"auth"}
              placeholder="Announcement's Title" 
              className="mb-4 rounded-[8px]"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
            />
            
            <Textarea 
              placeholder="Write something to your class..." 
              className="mb-4 min-h-[100px] resize-none border-gray-200 bg-gray-50/50"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            />

            {/* Area File Preview */}
            {postFile && (
               <div className="flex items-center gap-2 mb-4 bg-blue-50 p-2 rounded-md text-sm text-blue-700 w-fit">
                  <span>📎 {postFile.name}</span>
                  <button onClick={() => {setPostFile(null); if(fileInputRef.current) fileInputRef.current.value=""}} className="text-red-500 font-bold ml-2">X</button>
               </div>
            )}

            <div className="flex justify-between items-center mt-4 border-t pt-4">
               {/* Hidden Input File */}
               <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => { if(e.target.files?.[0]) setPostFile(e.target.files[0]) }}
               />
               
               <Button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-purple-base text-white hover:bg-purple-10"
               >
                 + Add Files
               </Button>

               <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    className="text-gray-500" 
                    onClick={() => {
                        setIsPostingMode(false);
                        setPostTitle("");
                        setPostContent("");
                        setPostFile(null);
                    }}
                  >
                    Undo
                  </Button>
                  <Button 
                    className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
                    onClick={handlePostAnnouncement}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Posting..." : "Announce"}
                  </Button>
               </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-5">
          {announcements.length > 0 ? (
                announcements.map((item) => (
                  <div key={item.id} className="bg-addition-blue-30 p-6 rounded-[12px]">
                    <div className="flex items-start gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-blue-100 text-sh6">
                            {item.title}
                        </p>
                        <p className="text-sh8 text-blue-100">Published On {formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                    <div className="ml-14">
                      <p className="text-b7 text-blue-100">{item.content}</p>
                      {item.fileUrl && (
                        <div className="flex justify-between items-center bg-white rounded-lg px-5 py-3 mt-4 border border-gray-100 shadow-sm w-full">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Image src={"/pdf.png"} alt="pdf" width={40} height={40} className="w-8 h-8 shrink-0"/>
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
                    <div className="flex gap-4 justify-end">
                      <button
                        onClick={() => openEditAnnouncement(item)}
                        className="text-b6 text-blue-base"
                      >
                        Update Announcement
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(item.id)}
                        className="text-b6 text-[#FF4646]"
                      >
                        Delete Announcement
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                 <div className="text-center py-10 border-2 border-dashed rounded-xl">
                   <p className="text-gray-400 mb-2">Belum ada pengumuman.</p>
                 </div>
              )}
        </div>
      </div>

      <Dialog open={!!editingAnnouncement} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
             <Input 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)} 
                placeholder="Judul Pengumuman"
             />
             <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)} 
                placeholder="Isi Pengumuman"
                className="min-h-[150px]"
             />
             <p className="text-xs text-gray-500 italic">*Mengedit file lampiran belum didukung.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAnnouncement(null)}>Batal</Button>
            <Button onClick={handleUpdateAnnouncement} className="bg-blue-base text-white">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}