"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

// Validation Schema
const assignmentSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  description: z.string().optional(),
  deadline: z.string().optional(),
  rubric: z.string().optional(), // 🔥 CHANGED: String instead of file
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function NewAssignmentPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const chapterId = searchParams.get('chapterId');
  const subId = searchParams.get('subId');

  const [loading, setLoading] = useState(false);
  const [subchapterTitle, setSubchapterTitle] = useState("Loading...");
  
  // Files state
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  // 🔥 REMOVED: rubricFile state (now using form input)

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      deadline: "",
      rubric: "", // 🔥 ADDED: Rubric as string
    },
  });

  // Fetch Subchapter Title
  useEffect(() => {
    const fetchSubchapter = async () => {
      if (!chapterId) return;
      const docRef = doc(db, "classes", id as string, "chapters", chapterId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const sub = data.subchapters?.find((s: any) => s.id === subId);
        if (sub) setSubchapterTitle(sub.title);
      }
    };
    fetchSubchapter();
  }, [chapterId, subId, id]);

  // Upload to Cloudinary
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

  // Submit Handler
  const onSubmit = async (data: AssignmentFormValues, status: 'draft' | 'published') => {
    if (!chapterId || !subId) {
      return toast.error("Error: Parameter tidak lengkap");
    }

    setLoading(true);
    try {
      // Upload all files
      let questionFileUrl = "";
      const additionalFileUrls: string[] = [];

      if (questionFile) {
        toast.info("Uploading question file...");
        questionFileUrl = await uploadFile(questionFile);
      }

      // 🔥 REMOVED: rubric file upload

      if (additionalFiles.length > 0) {
        toast.info("Uploading additional files...");
        for (const file of additionalFiles) {
          const url = await uploadFile(file);
          additionalFileUrls.push(url);
        }
      }

      // Fetch chapter
      const chapterRef = doc(db, "classes", id as string, "chapters", chapterId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        throw new Error("Chapter tidak ditemukan");
      }

      const chapterData = chapterSnap.data();

      // Update nested structure
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
                questionFileUrl: questionFileUrl,
                rubric: data.rubric || "", // 🔥 CHANGED: Save as string
                additionalFiles: additionalFileUrls,
                status: status,
                publishedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              }
            ]
          };
        }
        return sub;
      });

      await updateDoc(chapterRef, {
        subchapters: updatedSubchapters
      });

      const message = status === 'published' 
        ? "✅ Tugas berhasil diterbitkan!" 
        : "💾 Tugas disimpan sebagai draft";
      toast.success(message);
      router.push(`/class/${id}/activity`);

    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error("Gagal menyimpan tugas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b px-6 md:px-12 py-6 mb-8">
        <h1 className="text-4xl font-bold text-blue-600 mb-2">Make New Assignment</h1>
        <p className="text-gray-500 text-sm">in {subchapterTitle}</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN - Assignment Details */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Assignment Details</h2>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Assignment's Title</Label>
              <Input
                {...form.register('title')}
                placeholder="Write here"
                className="bg-blue-50 border-none h-14 text-base placeholder:text-gray-400"
              />
              {form.formState.errors.title && (
                <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Description</Label>
              <Textarea
                {...form.register('description')}
                placeholder="Write here"
                className="bg-blue-50 border-none min-h-[120px] text-base placeholder:text-gray-400 resize-none"
              />
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Set Deadline</Label>
              <div className="relative">
                <Input
                  type="date"
                  {...form.register('deadline')}
                  placeholder="DD/MM/YY"
                  className="bg-blue-50 border-none h-14 text-base placeholder:text-gray-400 pr-12"
                />
                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Additional Files */}
            <div className="pt-4">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setAdditionalFiles(prev => [...prev, ...files]);
                }}
                className="hidden"
                id="additional-files"
              />
              <label htmlFor="additional-files">
                <Button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white w-full h-14"
                  onClick={() => document.getElementById('additional-files')?.click()}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Addition Files
                </Button>
              </label>
              
              {additionalFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {additionalFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border text-sm">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAdditionalFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Scoring Details */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Scoring Details</h2>

            {/* Questions Details */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Questions Details</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                className="hidden"
                id="question-file"
              />
              <label htmlFor="question-file">
                <Button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white w-full h-14"
                  onClick={() => document.getElementById('question-file')?.click()}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add File/Image
                </Button>
              </label>
              {questionFile && (
                <div className="bg-white px-4 py-3 rounded-lg border text-sm flex items-center justify-between">
                  <span className="truncate">{questionFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setQuestionFile(null)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Assignment Rubric */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Assignment Rubric</Label>
              <Textarea
                {...form.register('rubric')}
                placeholder="Masukkan kriteria penilaian tugas..."
                className="bg-blue-50 border-none min-h-[150px] text-base placeholder:text-gray-400 resize-none"
              />
              <p className="text-xs text-gray-500">
                Contoh: Ketepatan jawaban (40%), Kreativitas (30%), Presentasi (30%)
              </p>
              
              {/* Ask Lynx - Placeholder */}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                onClick={() => toast.info("Feature coming soon!")}
              >
                Ask Lynx to do it
              </button>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-12 flex justify-center gap-4">
          <Button
            type="button"
            onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 h-14 text-lg font-semibold rounded-xl"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save As Draft"}
          </Button>
          
          <Button
            type="button"
            onClick={form.handleSubmit((data) => onSubmit(data, 'published'))}
            disabled={loading}
            className="bg-yellow-400 hover:bg-yellow-500 text-black px-12 h-14 text-lg font-semibold rounded-xl"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Now"}
          </Button>
        </div>
      </form>
    </div>
  );
}