"use client";

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
import { Plus, FileText, Download } from "lucide-react";
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
    }
  };

  // --- NAVIGATE TO ASSIGNMENT PAGE ---
  const goToAssignmentPage = (chapterId: string, subchapterId: string) => {
    router.push(
      `/class/${classId}/activity/new-assignment?chapterId=${chapterId}&subId=${subchapterId}`
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
    <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-blue-600">Classroom</h1>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => setShowDraftOnly(!showDraftOnly)}
            className={cn(
              "border-2 font-semibold transition-all",
              showDraftOnly 
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
            )}
          >
            📄 My Draft {showDraftOnly && "✓"}
          </Button>
          <Button 
            onClick={() => openModal('chapter')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chapter
          </Button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-8">
        <div className="relative">
          <Input 
            placeholder="Cari Materi atau Tugas"
            className="w-full max-w-xl pl-4 pr-12 py-6 rounded-full border-gray-200 bg-white shadow-sm"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </button>
        </div>
      </div>

      {/* CHAPTERS LIST */}
      <div className="space-y-6">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="overflow-hidden">
            
            {/* CHAPTER ACCORDION */}
            <Accordion type="multiple" className="w-full">
              <AccordionItem value={chapter.id} className="border-none">
                
                {/* CHAPTER TRIGGER - JUSTIFY BETWEEN */}
                <div className="flex items-center justify-between px-6 py-4">
                  <AccordionTrigger className="hover:no-underline py-0 flex-none [&>svg]:hidden">
                    <h2 className="text-xl font-bold text-blue-600 text-left">
                      {chapter.title}
                    </h2>
                  </AccordionTrigger>
                  
                  {/* NEW SUB CHAPTER BUTTON */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal('subchapter', chapter.id);
                    }}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Sub Chapter
                  </Button>
                </div>

                {/* CHAPTER CONTENT (SUBCHAPTERS) */}
                <AccordionContent className="px-6 pb-6 pt-0">
                  <div className="space-y-4">
                    {chapter.subchapters?.map((sub) => (
                      <div key={sub.id} className="pl-6">
                        
                        {/* SUBCHAPTER ACCORDION */}
                        <Accordion type="multiple" className="w-full">
                          <AccordionItem value={sub.id} className="border-none">
                            
                            {/* SUBCHAPTER TRIGGER - JUSTIFY BETWEEN */}
                            <div className="flex items-center justify-between mb-2">
                              <AccordionTrigger className="hover:no-underline py-2 flex-none [&>svg]:hidden">
                                <h3 className="text-lg font-semibold text-blue-600 text-left">
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
                                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  New Assignment
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openModal('material', chapter.id, sub.id);
                                  }}
                                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  New Material
                                </Button>
                              </div>
                            </div>

                            {/* SUBCHAPTER CONTENT */}
                            <AccordionContent className="pt-4 space-y-6">
                              
                              {/* MATERI SECTION */}
                              {sub.materials.length > 0 && (
                                <div>
                                  <h4 className="font-bold text-gray-900 mb-3">Materi</h4>
                                  <div className="space-y-2">
                                    {sub.materials.map((mat) => (
                                      <div 
                                        key={mat.id}
                                        className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-red-500 rounded flex items-center justify-center text-white font-bold">
                                            📄
                                          </div>
                                          <span className="font-medium text-gray-900">
                                            {mat.title}
                                          </span>
                                        </div>
                                        
                                        <button
                                          onClick={() => handleDownload(mat.url, mat.title)}
                                          className="text-gray-600 hover:text-blue-600 transition-colors"
                                        >
                                          <Download className="w-5 h-5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* TUGAS SECTION */}
                              {sub.assignments.length > 0 && (
                                <div>
                                  <h4 className="font-bold text-gray-900 mb-3">Tugas</h4>
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
                                            "flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
                                            assignment.status === 'draft'
                                              ? "bg-gray-200 border-gray-300" // Draft: Darker
                                              : "bg-gray-50 border-gray-100 hover:bg-gray-100" // Published: Lighter
                                          )}
                                        >
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <p className="font-bold text-gray-900">
                                                {assignment.title}
                                              </p>
                                              {assignment.status === 'draft' && (
                                                <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                                                  DRAFT
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
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
                                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2"
                                          >
                                            See More
                                          </Button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* EMPTY STATE */}
                              {sub.materials.length === 0 && sub.assignments.length === 0 && (
                                <p className="text-gray-400 text-center py-8 text-sm">
                                  Belum ada materi atau tugas di sub chapter ini
                                </p>
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

        {/* EMPTY CHAPTERS */}
        {chapters.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 text-lg mb-4">Belum ada chapter</p>
            <Button onClick={() => openModal('chapter')} className="bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Buat Chapter Pertama
            </Button>
          </div>
        )}
      </div>

      {/* MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {modalType === 'chapter' && 'Add New Chapter'}
              {modalType === 'subchapter' && 'Add New Sub Chapter'}
              {modalType === 'material' && 'Add New Material'}
            </DialogTitle>
            {modalType === 'subchapter' && selectedChapterId && (
              <p className="text-center text-sm text-gray-500 mt-1">
                in {chapters.find(c => c.id === selectedChapterId)?.title}
              </p>
            )}
            {modalType === 'material' && selectedSubId && (
              <p className="text-center text-sm text-gray-500 mt-1">
                in {chapters
                  .find(c => c.id === selectedChapterId)
                  ?.subchapters.find(s => s.id === selectedSubId)?.title}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                {modalType === 'chapter' && "Chapter's Title"}
                {modalType === 'subchapter' && "Sub Chapter's Title"}
                {modalType === 'material' && "Material Title"}
              </Label>
              <Input
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder={`Enter ${modalType} title...`}
                className="bg-blue-50 border-none"
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

                <div className="text-center text-gray-400 text-sm">OR</div>

                <div className="space-y-2">
                  <Label>Paste URL</Label>
                  <Input
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-blue-50 border-none"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleSave}
              disabled={!inputTitle}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}