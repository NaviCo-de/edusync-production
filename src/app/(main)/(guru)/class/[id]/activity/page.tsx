"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase"; 
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

// UI Components
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input"; 
import { Label } from "@/components/ui/label"; 
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Icons
import { PenTool, Loader2, UploadCloud, FileText } from "lucide-react"; 

// Tipe Data
interface ModuleItem {
  id: string;
  title: string;
  type: 'chapter' | 'subchapter' | 'material' | 'assignment';
  parentId?: string | null;
  status: 'draft' | 'published';
  classId: string;
  fileUrl?: string;
}

export default function ClassActivityPage() {
  const { id } = useParams(); 
  const router = useRouter();
  
  const [items, setItems] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    type: 'chapter' | 'subchapter' | 'material';
    parentId: string | null;
    title: string;
  }>({ type: 'chapter', parentId: null, title: 'Buat Baru' });
  
  const [inputTitle, setInputTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- 1. FETCH DATA ---
  const fetchModules = async () => {
    if (!id) return;
    try {
      const q = query(collection(db, "modules"), where("classId", "==", id));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ModuleItem));
      setItems(data.sort((a, b) => (a.title > b.title ? 1 : -1))); 
    } catch (error) {
      console.error("Error fetching modules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [id]);

  // --- 2. UPLOAD & CREATE ---
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/raw/upload`, 
      { method: "POST", body: formData }
    );
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload file");
    return data.secure_url;
  }

  const handleCreate = async () => {
    if (!inputTitle) return alert("Judul tidak boleh kosong");
    
    setIsUploading(true);
    let finalFileUrl = "";

    try {
      if (modalConfig.type === 'material' && selectedFile) {
        finalFileUrl = await uploadFile(selectedFile);
      }

      await addDoc(collection(db, "modules"), {
        classId: id,
        title: inputTitle,
        type: modalConfig.type,
        parentId: modalConfig.parentId,
        status: "published",
        fileUrl: finalFileUrl,
        createdAt: serverTimestamp(),
      });
      
      setIsModalOpen(false);
      setInputTitle("");
      setSelectedFile(null);
      fetchModules(); 
    } catch (error) {
      console.error("Error creating:", error);
      alert("Gagal membuat data.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
      setInputTitle(nameWithoutExt);
    }
  }

  // --- 3. FILTERING ---
  const chapters = items.filter(i => i.type === 'chapter');
  const getSubchapters = (chapterId: string) => 
    items.filter(i => i.type === 'subchapter' && i.parentId === chapterId);
  const getMaterials = (subchapterId: string) => 
    items.filter(i => (i.type === 'material' || i.type === 'assignment') && i.parentId === subchapterId);

  // --- STYLE CONSTANTS ---
  const yellowBtnClass = "bg-[#FFE133] text-black hover:bg-[#E6C200] border-none font-medium text-xs px-4 py-2 h-auto rounded-md shadow-sm";
  const blueTextClass = "text-[#466BFF] font-bold text-xl"; 
  const blueSubTextClass = "text-[#466BFF] font-semibold text-lg";

  // Helper Buka Modal
  const openCreateModal = (e: React.MouseEvent, type: 'chapter' | 'subchapter' | 'material', parentId: string | null = null, modalTitle: string) => {
    e.stopPropagation(); // [CRITICAL] Mencegah Accordion tertutup/terbuka saat klik tombol
    setModalConfig({ type, parentId, title: modalTitle });
    setInputTitle(""); 
    setSelectedFile(null); 
    setIsModalOpen(true);
  };

  const handleGoToAssignment = (e: React.MouseEvent, parentId: string) => {
    e.stopPropagation();
    router.push(`/class/${id}/activity/new-assignment?parentId=${parentId}`);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 min-h-screen">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Kurikulum</h1>
           <p className="text-gray-500 text-sm">Susun materi pembelajaran</p>
        </div>
        <Button onClick={(e) => openCreateModal(e, 'chapter', null, 'Buat Chapter Baru')} className={yellowBtnClass}>
          + Chapter Baru
        </Button>
      </div>

      {/* LIST KURIKULUM */}
      <div className="space-y-4">
        {loading ? <p>Loading...</p> : (
          <Accordion type="multiple" className="w-full space-y-4 border-none">
            
            {chapters.map((chapter) => (
              <AccordionItem key={chapter.id} value={chapter.id} className="border-none shadow-none">
                
                {/* 1. HEADER CHAPTER (Flex Justify Between) */}
                <AccordionTrigger className="hover:no-underline py-2 px-0 [&>svg]:hidden w-full">
                  <div className="flex items-center justify-between w-full pr-2">
                    {/* Judul Kiri */}
                    <span className={blueTextClass}>{chapter.title}</span>
                    
                    {/* Tombol Kanan */}
                    <Button 
                      size="sm"
                      className={yellowBtnClass} 
                      onClick={(e) => openCreateModal(e, 'subchapter', chapter.id, `Subchapter Baru di ${chapter.title}`)}
                    >
                      + Sub Chapter
                    </Button>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="p-0 pl-6">
                   {/* 2. LIST SUBCHAPTER */}
                   <Accordion type="multiple" className="w-full border-none">
                      {getSubchapters(chapter.id).map((sub) => (
                        <AccordionItem key={sub.id} value={sub.id} className="border-none mb-2">
                           
                           {/* HEADER SUBCHAPTER (Flex Justify Between) */}
                           <AccordionTrigger className="hover:no-underline py-2 px-0 [&>svg]:hidden w-full">
                              <div className="flex items-center justify-between w-full pr-2">
                                {/* Judul Kiri */}
                                <span className={blueSubTextClass}>{sub.title}</span>

                                {/* Tombol Kanan (Group Button) */}
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm"
                                    className={yellowBtnClass}
                                    onClick={(e) => openCreateModal(e, 'material', sub.id, `Upload Material ke ${sub.title}`)}
                                  >
                                    + Material
                                  </Button>
                                  <Button 
                                    size="sm"
                                    className={yellowBtnClass}
                                    onClick={(e) => handleGoToAssignment(e, sub.id)}
                                  >
                                    + Assignment
                                  </Button>
                                </div>
                              </div>
                           </AccordionTrigger>

                           <AccordionContent className="p-0 space-y-2">
                              {/* 3. LIST MATERIAL (Isi Subchapter) */}
                              <div className="space-y-2 pt-2"> 
                                {getMaterials(sub.id).map((mat) => (
                                  <div key={mat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group cursor-pointer border border-transparent hover:border-gray-200">
                                     <div className="flex items-center gap-3">
                                        {mat.type === 'assignment' ? (
                                          <PenTool size={18} className="text-orange-500" />
                                        ) : (
                                          <FileText size={18} className="text-gray-500" />
                                        )}
                                        
                                        <div className="flex flex-col">
                                          <span className="font-medium text-gray-700 group-hover:text-blue-600">
                                            {mat.title}
                                          </span>
                                          {mat.fileUrl && (
                                            <a href={mat.fileUrl} target="_blank" className="text-xs text-blue-400 hover:underline">
                                              Download File
                                            </a>
                                          )}
                                        </div>
                                     </div>
                                  </div>
                                ))}
                                {getMaterials(sub.id).length === 0 && (
                                  <p className="text-gray-400 text-sm italic">Belum ada materi.</p>
                                )}
                              </div>
                           </AccordionContent>
                        </AccordionItem>
                      ))}
                   </Accordion>

                   {/* Empty State Subchapter */}
                   {getSubchapters(chapter.id).length === 0 && (
                     <p className="text-gray-400 text-sm italic py-2">Belum ada subchapter.</p>
                   )}

                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* MODAL GLOBAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalConfig.title}</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {modalConfig.type === 'material' && (
              <div className="grid gap-2">
                <Label>Upload File Materi</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors relative">
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-gray-400 mb-2"/>
                  <p className="text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : "Klik untuk pilih file"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Nama {modalConfig.type === 'chapter' ? 'Chapter' : modalConfig.type === 'subchapter' ? 'Sub Chapter' : 'Materi'}</Label>
              <Input 
                value={inputTitle} 
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder="Masukkan nama..." 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={isUploading} className="bg-blue-600 text-white">
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}