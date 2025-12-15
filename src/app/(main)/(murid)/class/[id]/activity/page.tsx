"use client";

import { CustomIcon } from '@/components/ui/CustomIcon';
import Image from 'next/image';
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// --- TYPES (SAMA PERSIS) ---
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

export default function ClassActivityPageStudent() {
  const { id: classId } = useParams();
  
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);

  // --- FETCH DATA (SAMA) ---
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

  // --- DOWNLOAD HANDLER (SAMA) ---
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
      {/* HEADER - HAPUS TOMBOL MY DRAFT & NEW CHAPTER */}
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

      {/* CHAPTERS LIST - TANPA TOMBOL EDIT */}
      <div>
        {chapters.map((chapter) => (
          <div key={chapter.id} className="overflow-hidden">
            
            {/* CHAPTER ACCORDION */}
            <Accordion type="multiple" className="w-full">
              <AccordionItem value={chapter.id} className="border-none">
                
                {/* CHAPTER TRIGGER - TANPA TOMBOL NEW SUB CHAPTER */}
                <div className="flex items-center justify-between py-4">
                  <AccordionTrigger className="hover:no-underline py-0 flex-none [&>svg]:hidden">
                    <h2 className="text-sh4 font-bold text-blue-base text-left hover:underline">
                      {chapter.title}
                    </h2>
                  </AccordionTrigger>
                </div>

                {/* CHAPTER CONTENT (SUBCHAPTERS) */}
                <AccordionContent className="pl-6 pb-6 pt-0">
                  <div className="space-y-4">
                    {chapter.subchapters?.map((sub) => (
                      <div key={sub.id} className="pl-6">
                        
                        {/* SUBCHAPTER ACCORDION */}
                        <Accordion type="multiple" className="w-full">
                          <AccordionItem value={sub.id} className="border-none">
                            
                            {/* SUBCHAPTER TRIGGER - TANPA ACTION BUTTONS */}
                            <div className="flex items-center justify-between mb-2">
                              <AccordionTrigger className="hover:no-underline py-2 flex-none [&>svg]:hidden">
                                <h3 className="text-sh5 font-semibold text-blue-base text-left hover:underline">
                                  {sub.title}
                                </h3>
                              </AccordionTrigger>
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

                              {/* TUGAS SECTION - FILTER DRAFT */}
                              <h4 className="text-sh6 font-semibold mb-3">Tugas</h4>
                              {sub.assignments.filter(a => a.status === 'published').length > 0 ? (
                                <div>
                                  <div className="space-y-2">
                                    {sub.assignments
                                      .filter((assignment: any) => assignment.status === 'published') // 🔥 HANYA PUBLISHED
                                      .map((assignment: any) => (
                                        <div 
                                          key={assignment.id}
                                          className="flex items-center justify-between px-4 py-3 rounded-sm bg-white hover:bg-[#E7E7E7] transition-all"
                                        >
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <p className="text-sh6 font-semibold">
                                                {assignment.title}
                                              </p>
                                            </div>
                                            <p className="text-sh7">
                                              Published on {new Date(assignment.publishedAt).toLocaleDateString('en-GB', {
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

                              {/* EMPTY STATE */}
                              {sub.materials.length === 0 && 
                               sub.assignments.filter(a => a.status === 'published').length === 0 && (
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
                        Belum ada sub chapter di chapter ini.
                      </p>
                    )}
                  </div>
                </AccordionContent>

              </AccordionItem>
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  );
}