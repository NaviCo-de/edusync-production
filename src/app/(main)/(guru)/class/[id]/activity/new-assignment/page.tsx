"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image"; 

import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Sparkles } from "lucide-react"; 
import { toast } from "sonner";
import { CustomIcon } from "@/components/ui/CustomIcon";
import { AskLynxModal } from "@/app/(main)/(guru)/components/AskLynxModal";

// Validation Schema
const assignmentSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  description: z.string().optional(),
  deadline: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

// [BARU] Tipe data Hybrid (Bisa File Lokal ATAU URL dari AI)
interface FileData {
  file: File | null; // Jika upload manual
  url: string | null; // Jika dari AI
  name: string;      // Nama untuk ditampilkan di UI
}

export default function NewAssignmentPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const chapterId = searchParams.get('chapterId');
  const subId = searchParams.get('subId');

  const [loading, setLoading] = useState(false);
  const [isLynxModalOpen, setIsLynxModalOpen] = useState(false); // State Modal
  
  // [MODIFIKASI] State File sekarang menggunakan tipe FileData
  const [questionData, setQuestionData] = useState<FileData | null>(null);
  const [rubricData, setRubricData] = useState<FileData | null>(null);

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      deadline: "",
    },
  });

  // Fungsi Upload ke Cloudinary (Hanya dipanggil jika file lokal)
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

  // [BARU] Callback saat AI selesai generate
  const handleAiSuccess = (qUrl: string, rUrl: string) => {
    // Inject URL AI ke state, seolah-olah user sudah upload
    setQuestionData({
      file: null,
      url: qUrl,
      name: "AI_Generated_Question.pdf"
    });
    setRubricData({
      file: null,
      url: rUrl,
      name: "AI_Generated_Rubric.pdf"
    });
  };

  // Submit Handler
  const onSubmit = async (data: AssignmentFormValues, status: 'draft' | 'published') => {
    if (!chapterId || !subId) return toast.error("Error: Parameter tidak lengkap");

    setLoading(true);
    try {
      let finalQuestionUrl = "";
      let finalRubricUrl = "";

      // 1. Handle Question Data
      if (questionData) {
        if (questionData.file) {
          // Kasus A: File Lokal -> Upload dulu
          toast.info("Uploading question file...");
          finalQuestionUrl = await uploadFile(questionData.file);
        } else if (questionData.url) {
          // Kasus B: Dari AI -> Langsung pakai URL
          finalQuestionUrl = questionData.url;
        }
      }

      // 2. Handle Rubric Data
      if (rubricData) {
        if (rubricData.file) {
          toast.info("Uploading rubric file...");
          finalRubricUrl = await uploadFile(rubricData.file);
        } else if (rubricData.url) {
          finalRubricUrl = rubricData.url;
        }
      }

      // 3. Update Firestore
      const chapterRef = doc(db, "classes", id as string, "chapters", chapterId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) throw new Error("Chapter tidak ditemukan");
      const chapterData = chapterSnap.data();

      const updatedSubchapters = chapterData.subchapters.map((sub: any) => {
        if (sub.id === subId) {
          return {
            ...sub,
            assignments: [
              ...(sub.assignments || []),
              {
                id: uuidv4(),
                title: data.title,
                description: data.description || "",
                deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
                questionFileUrl: finalQuestionUrl,
                rubricFileUrl: finalRubricUrl, 
                status: status,
                publishedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              }
            ]
          };
        }
        return sub;
      });

      await updateDoc(chapterRef, { subchapters: updatedSubchapters });

      toast.success(status === 'published' ? "✅ Tugas diterbitkan!" : "💾 Disimpan sebagai draft");
      router.push(`/class/${id}/activity`);

    } catch (error) {
      console.error("Error:", error);
      toast.error("Gagal menyimpan tugas");
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk set File Lokal
  const handleLocalFileSelect = (file: File | null, type: 'question' | 'rubric') => {
    if (!file) {
      if(type === 'question') setQuestionData(null);
      else setRubricData(null);
      return;
    }
    const newData: FileData = { file: file, url: null, name: file.name };
    if(type === 'question') setQuestionData(newData);
    else setRubricData(newData);
  };

  // --- UI RENDERER (Diupdate untuk handle FileData) ---
  const renderFileUpload = (
    dataState: FileData | null, 
    type: 'question' | 'rubric',
    inputId: string
  ) => {
    if (dataState) {
      // TAMPILAN JIKA ADA DATA (BAIK FILE LOKAL MAUPUN AI)
      return (
        <div className="relative group">
           <div className={`flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm ${!dataState.file ? "border-purple-200 bg-purple-50" : "border-gray-200"}`}>
              <Image src="/pdf.png" alt="File Icon" width={40} height={40} className="w-10 h-10 object-contain"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{dataState.name}</p>
                <p className="text-xs text-gray-500">
                  {dataState.file ? `${(dataState.file.size / 1024 / 1024).toFixed(2)} MB` : "Generated by Lynx AI ✨"}
                </p>
              </div>
              <button type="button" onClick={() => type === 'question' ? setQuestionData(null) : setRubricData(null)} className="p-2 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-5 h-5 text-red-500" />
              </button>
           </div>
        </div>
      );
    }

    // TAMPILAN DEFAULT (UPLOAD BUTTON)
    return (
      <>
        <input
          type="file"
          accept="image/*,application/pdf,.doc,.docx"
          onChange={(e) => handleLocalFileSelect(e.target.files?.[0] || null, type)}
          className="hidden"
          id={inputId}
        />
        <label htmlFor={inputId}>
          <div className="flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white w-full h-14 rounded-xl cursor-pointer transition-all active:scale-95">
            <CustomIcon src="/plus.png" className="w-6 h-6 bg-white" />
            <p className="text-sh6 font-semibold">Add File/Image</p>
          </div>
        </label>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 mx-20 mt-11">
      {/* MODAL LYNX DI SINI */}
      <AskLynxModal 
        isOpen={isLynxModalOpen} 
        onClose={() => setIsLynxModalOpen(false)} 
        onSuccess={handleAiSuccess} 
      />

      <div className="mb-10"><p className="text-sh3 font-semibold bg-linear-to-r from-blue-40 to-blue-base bg-clip-text text-transparent">Make New Assignment</p></div>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* KOLOM KIRI (Sama seperti sebelumnya) */}
          <div className="space-y-6">
            <h2 className="text-sh4 font-semibold text-black">Assignment Details</h2>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Assignment's Title</Label>
              <Input variant={"auth"} {...form.register('title')} placeholder="Write here" />
              {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Description</Label>
              <Input variant="auth" {...form.register('description')} placeholder="Write here" />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Set Deadline</Label>
              <Input variant="auth" type="date" {...form.register('deadline')} />
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="space-y-6">
            <h2 className="text-sh4 font-semibold">Scoring Details</h2>

            {/* Questions Details */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Questions Details</Label>
              {renderFileUpload(questionData, 'question', "question-file-input")}
            </div>

            {/* Assignment Rubric */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Assignment Rubric</Label>
              {renderFileUpload(rubricData, 'rubric', "rubric-file-input")}
              
              <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setIsLynxModalOpen(true)} // BUKA MODAL
                    className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1 transition-all hover:gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    Ask Lynx to do it
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TOMBOL SAVE */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-12 flex justify-center gap-4">
          <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-12 h-14 text-lg font-semibold rounded-xl">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save As Draft"}
          </Button>
          <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, 'published'))} disabled={loading} className="bg-yellow-400 hover:bg-yellow-500 text-black px-12 h-14 text-lg font-semibold rounded-xl">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Now"}
          </Button>
        </div>
      </form>
    </div>
  );
}