"use client";

import { CustomIcon } from '@/components/ui/CustomIcon';
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

// --- FIXED TYPES ---
interface Material {
  id: string;
  title: string;
  type: "pdf" | "video" | "link";
  url: string;
  createdAt: string;
}

interface AssignmentRef {
  id: string;
  title: string;
  publishedAt: string;
  status: "draft" | "published";
}

interface SubChapter {
  id: string;
  title: string;
  materials: Material[];
  assignments: AssignmentRef[];
}

interface ChapterData {
  id: string;
  title: string;
  subchapters: SubChapter[];
  createdAt: any;
}

export default function ClassActivityPage() {
  const { id: classId } = useParams();
  const router = useRouter();
  
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🔥 NEW: Draft Filter
  const [showDraftOnly, setShowDraftOnly] = useState(false);

  // STATE MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'chapter' | 'subchapter' | 'material' | null>(null);
  const [inputTitle, setInputTitle] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // TRACKING CONTEXT
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FETCH DATA ---
  const fetchChapters = async () => {
    if (!classId) return;
    try {
      const q = query(
        collection(db, "classes", classId as string, "chapters"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ChapterData[];
      setChapters(data);
    } catch (error) {
      console.error("Error fetching chapters:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChapters(); }, [classId]);

  // --- OPEN MODAL ---
  const openModal = (
    type: 'chapter' | 'subchapter' | 'material',
    chapId?: string,
    subId?: string
  ) => {
    setModalType(type);
    setSelectedChapterId(chapId || null);
    setSelectedSubId(subId || null);
    setInputTitle("");
    setInputUrl("");
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  // --- CLOUDINARY UPLOAD ---
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    const endpoint = file.type.startsWith('image/') 
      ? `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`
      : `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/raw/upload`;

    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Upload failed");
    return data.secure_url;
  };

  // --- SAVE HANDLER ---
  const handleSave = async () => {
    if (!inputTitle) return toast.error("Judul wajib diisi");
    if (modalType === 'material') {
        if (!selectedFile && !inputUrl.trim()) {
            return toast.error("Wajib upload file atau isi URL Link!");
        }
    }

    setIsSubmitting(true);

    try {
      // CASE 1: NEW CHAPTER
      if (modalType === 'chapter') {
        await addDoc(collection(db, "classes", classId as string, "chapters"), {
          title: inputTitle,
          subchapters: [],
          createdAt: serverTimestamp()
        });
        toast.success("Chapter berhasil dibuat");
      }
      
      // CASE 2: NEW SUBCHAPTER
      else if (modalType === 'subchapter' && selectedChapterId) {
        const chapterIndex = chapters.findIndex(c => c.id === selectedChapterId);
        if (chapterIndex === -1) return;

        const updatedChapter = { ...chapters[chapterIndex] };
        updatedChapter.subchapters.push({
          id: uuidv4(),
          title: inputTitle,
          materials: [],
          assignments: []
        });

        const chapterRef = doc(db, "classes", classId as string, "chapters", selectedChapterId);
        await updateDoc(chapterRef, {
          subchapters: updatedChapter.subchapters
        });
        
        toast.success("Sub Chapter berhasil dibuat");
      }

      // CASE 3: NEW MATERIAL
      else if (modalType === 'material' && selectedChapterId && selectedSubId) {
        let fileUrl = inputUrl;

        // Upload file if exists
        if (selectedFile) {
          toast.info("Uploading file...");
          fileUrl = await uploadFile(selectedFile);
        }

        if (!fileUrl) {
          return toast.error("URL atau file wajib diisi");
        }

        const chapterIndex = chapters.findIndex(c => c.id === selectedChapterId);
        if (chapterIndex === -1) return;

        const updatedChapter = { ...chapters[chapterIndex] };
        const subIndex = updatedChapter.subchapters.findIndex(s => s.id === selectedSubId);
        
        if (subIndex === -1) return;

        // Detect file type
        let materialType: "pdf" | "video" | "link" = "link";
        if (selectedFile) {
          if (selectedFile.type === "application/pdf") materialType = "pdf";
          else if (selectedFile.type.startsWith("video/")) materialType = "video";
        } else if (fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be')) {
          materialType = "video";
        }

        updatedChapter.subchapters[subIndex].materials.push({
          id: uuidv4(),
          title: inputTitle,
          type: materialType,
          url: fileUrl,
          createdAt: new Date().toISOString()
        });

        const chapterRef = doc(db, "classes", classId as string, "chapters", selectedChapterId);
        await updateDoc(chapterRef, {
          subchapters: updatedChapter.subchapters
        });

        toast.success("Material berhasil ditambahkan");
      }

      setIsModalOpen(false);
      fetchChapters();

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- NAVIGATE TO ASSIGNMENT PAGE ---
  const goToAssignmentPage = (chapterId: string, subchapterId: string) => {
    router.push(
      `/manage-class/${classId}/activity/new-assignment?chapterId=${chapterId}&subId=${subchapterId}`
    );
  };

  // --- DOWNLOAD HANDLER ---
  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 animate-pulse">Loading chapters...</p>
      </div>
    );
  }

  return (
    <div className="mx-20 mt-11 pb-20">
      <div className="flex items-center justify-between mb-12">
        <div className="flex justify-center items-center">
          <p className="text-sh1 font-semibold 
                        bg-linear-to-r from-blue-20 via-blue-40 to-blue-base
                        bg-clip-text text-transparent"
          >
            Activity
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
      <div className='flex gap-5'>
        <Button
          onClick={() => setShowDraftOnly(!showDraftOnly)}
          className={cn(
              // 1. Class Dasar (Selalu dipakai)
              'flex group px-6 py-3 rounded-[8px] h-12 transition-all border-2',
              
              // 2. Logic Pembeda (Ternary Operator)
              showDraftOnly 
                ? "bg-white border-blue-base" // JIKA AKTIF: Jadi Putih, Border Biru
                : "bg-blue-base border-transparent hover:bg-blue-10" // JIKA MATI: Jadi Biru Full
          )}>
          <CustomIcon 
            src={"/my_draft.png"}
            className={cn(
                'w-7 h-7 transition-colors', 
                showDraftOnly 
                  ? "bg-blue-base" // Icon jadi Biru (karena background tombol putih)
                  : "bg-white group-hover:bg-blue-base" // Icon Putih
            )}
          />
          <p className={cn(
              'text-sh6 font-semibold ml-2 transition-colors',
              showDraftOnly 
                ? "text-blue-base" // Teks jadi Biru
                : "text-white group-hover:text-blue-base" // Teks Putih
          )}>
            My Draft
          </p>
        </Button>

        <Button
          onClick={() => openModal('chapter')}
          className='flex group bg-blue-base px-6 py-3 rounded-[8px] h-12 hover:bg-blue-10'
        >
          <CustomIcon 
            src={"/plus.png"}
            className='w-7 h-7 bg-white group-hover:bg-blue-base'
          />
          <p className='text-white text-sh6 font-semibold group-hover:text-blue-base'>New Chapter</p>
        </Button>
      </div>
      <div>
        {chapters.map((chapter) => (
          <div key={chapter.id} className="overflow-hidden">
            
            {/* CHAPTER ACCORDION */}
            <Accordion type="multiple" className="w-full">
              <AccordionItem value={chapter.id} className="border-none">
                
                {/* CHAPTER TRIGGER - JUSTIFY BETWEEN */}
                <div className="flex items-center justify-between py-4">
                  <AccordionTrigger className="hover:no-underline py-0 flex-none [&>svg]:hidden">
                    <h2 className="text-sh4 font-bold text-blue-base text-left hover:underline">
                      {chapter.title}
                    </h2>
                  </AccordionTrigger>
                  
                  {/* NEW SUB CHAPTER BUTTON */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal('subchapter', chapter.id);
                    }}
                    className="flex items-center group bg-yellow-base hover:scale-100 hover:bg-yellow-10 px-4 py-2 rounded-lg"
                  >
                    <CustomIcon 
                      src={"/plus.png"}
                      className='w-6 h-6 bg-yellow-90 group-hover:bg-yellow-80'
                    />
                    <p className='text-b7 font-normal text-yellow-90 group-hover:text-yellow-80'>New Sub Chapter</p>
                  </Button>
                </div>

                {/* CHAPTER CONTENT (SUBCHAPTERS) */}
                <AccordionContent className="pl-6 pb-6 pt-0">
                  <div className="space-y-4">
                    {chapter.subchapters?.map((sub) => (
                      <div key={sub.id} className="pl-6">
                        
                        {/* SUBCHAPTER ACCORDION */}
                        <Accordion type="multiple" className="w-full">
                          <AccordionItem value={sub.id} className="border-none">
                            
                            {/* SUBCHAPTER TRIGGER - JUSTIFY BETWEEN */}
                            <div className="flex items-center justify-between mb-2">
                              <AccordionTrigger className="hover:no-underline py-2 flex-none [&>svg]:hidden">
                                <h3 className="text-sh5 font-semibold text-blue-base text-left hover:underline">
                                  {sub.title}
                                </h3>
                              </AccordionTrigger>

                              {/* ACTION BUTTONS */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    goToAssignmentPage(chapter.id, sub.id);
                                  }}
                                  className="flex items-center group bg-yellow-base hover:scale-100 hover:bg-yellow-10 px-4 py-2 rounded-lg"
                                >
                                  <CustomIcon 
                                    src={"/plus.png"}
                                    className='w-6 h-6 bg-yellow-90 group-hover:bg-yellow-80'
                                  />
                                  <p className='text-b7 font-normal text-yellow-90 group-hover:text-yellow-80'>New Assignment</p>
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openModal('material', chapter.id, sub.id);
                                  }}
                                  className="flex items-center group bg-yellow-base hover:scale-100 hover:bg-yellow-10 px-4 py-2 rounded-lg"
                                >
                                  <CustomIcon 
                                    src={"/plus.png"}
                                    className='w-6 h-6 bg-yellow-90 group-hover:bg-yellow-80'
                                  />
                                  <p className='text-b7 font-normal text-yellow-90 group-hover:text-yellow-80'>New Material</p>
                                </Button>
                              </div>
                            </div>

                            {/* SUBCHAPTER CONTENT */}
                            <AccordionContent className="pt-4 pl-6">
                              <h4 className="text-sh6 font-semibold mb-3">Materi</h4>
                              {/* MATERI SECTION */}
                              {sub.materials.length > 0 ? (
                                <>
                                  <div className="flex flex-col gap-3 mb-5">
                                    {sub.materials.map((mat) => (
                                      <div 
                                        key={mat.id}
                                        className="flex items-center justify-between bg-white px-4 py-3 rounded-sm hover:bg-[#E7E7E7] transition-colors"
                                      >
                                        <div className="flex items-center gap-5">
                                          <Image 
                                            src={"/pdf.png"}
                                            alt='pdf'
                                            width={500}
                                            height={500}
                                            className='w-7 h-8'
                                          />
                                          <span className="text-b7 font-normal">
                                            {mat.title}
                                          </span>
                                        </div>
                                        
                                        <button
                                          onClick={() => handleDownload(mat.url, mat.title)}
                                        >
                                          <Image 
                                            src={"/download.png"}
                                            alt='download'
                                            width={500}
                                            height={500}
                                            className='w-7 h-7'
                                          />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-gray-400 text-center py-8 text-b6">
                                    Belum ada materi di sub chapter ini
                                  </p>
                                </>
                              )}

                              {/* TUGAS SECTION */}
                              <h4 className="text-sh6 font-semibold mb-3">Tugas</h4>
                              {sub.assignments.length > 0 ? (
                                <div>
                                  <div className="space-y-2">
                                    {sub.assignments
                                      .filter((assignment: any) => {
                                        // Filter logic: show draft only atau show all
                                        if (showDraftOnly) {
                                          return assignment.status === 'draft';
                                        }
                                        return true; // Show all
                                      })
                                      .map((assignment: any) => (
                                        <div 
                                          key={assignment.id}
                                          className={cn(
                                            "flex items-center justify-between px-4 py-3 rounded-sm transition-all",
                                            assignment.status === 'draft'
                                              ? "bg-[#E7E7E7]" // Draft: Darker
                                              : "bg-white hover:bg-[#E7E7E7]" // Published: Lighter
                                          )}
                                        >
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <p className="text-sh6 font-semibold">
                                                {assignment.title}
                                              </p>
                                            </div>
                                            <p className="text-sh7">
                                              {assignment.status === 'published' ? 'Published' : 'Created'} on {new Date(assignment.publishedAt).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </p>
                                          </div>
                                          
                                          <Button
                                            variant="ghost"
                                            className="bg-purple-base hover:bg-purple-10 text-white hover:text-purple-base text-b8 px-4 py-2"
                                          >
                                            See More
                                          </Button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-gray-400 text-center py-8 text-b6">
                                    Belum ada tugas di sub chapter ini
                                  </p>
                                </>
                              )}

                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    ))}

                    {/* EMPTY SUBCHAPTERS */}
                    {(!chapter.subchapters || chapter.subchapters.length === 0) && (
                      <p className="text-gray-400 text-center py-6 text-sm">
                        Belum ada sub chapter. Klik tombol "New Sub Chapter" untuk menambahkan.
                      </p>
                    )}
                  </div>
                </AccordionContent>

              </AccordionItem>
            </Accordion>
          </div>
        ))}
      </div>
      {/* MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <div className='hidden'>
          <DialogTitle></DialogTitle>
        </div>
        <DialogContent className=''>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {modalType === 'chapter' && (<p className="text-center text-sh3 font-semibold">Add New Chapter</p>)}
              {modalType === 'subchapter' && (<p className="text-center text-sh3 font-semibold">Add New Sub Chapter</p>)}
              {modalType === 'material' && (<p className="text-center text-sh3 font-semibold">Add New Material</p>)}
              {modalType === 'subchapter' && selectedChapterId && (
                <p className="text-center text-b5 text-black mt-1">
                  in {chapters.find(c => c.id === selectedChapterId)?.title}
                </p>
              )}
              {modalType === 'material' && selectedSubId && (
                <p className="text-center text-b5 text-black mt-1">
                  in {chapters
                    .find(c => c.id === selectedChapterId)
                    ?.subchapters.find(s => s.id === selectedSubId)?.title}
                </p>
              )}
              <Input
                type='auth'
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder={`${modalType}'s title...`}
                className="placeholder:text-b6 placeholder:font-normal mt-5 h-15"
              />
            </div>

            {modalType === 'material' && (
              <div className="space-y-3">
                <div className="text-center">
                  <Label className="block mb-2">Upload File</Label>
                  <input
                    type="file"
                    accept="application/pdf,video/*,image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <div className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors">
                      <Plus className="w-4 h-4" />
                      Add File/Image
                    </div>
                  </label>
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>                
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleSave}
              disabled={!inputTitle}
              className="w-full bg-blue-base hover:bg-blue-700 hover:scale-100 text-white"
            >
              {isSubmitting ? (
                <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Saving...
                </>
              ) : (
                <p className='text-b6 font-semibold'>Save</p>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* BATAS DISINI */}
    </div>
  );
}