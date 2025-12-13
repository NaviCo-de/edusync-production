"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form"; // [BARU]
import { zodResolver } from "@hookform/resolvers/zod"; // [BARU]
import { assignmentSchema, type AssignmentFormValues } from "@/lib/databaseValidation"; // [BARU]

import { db } from "@/lib/firebase"; 
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { X, UploadCloud, Loader2, FileText, Save } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"; // [BARU] Komponen form shadcn

export default function NewAssignmentPage() {
  const { id } = useParams(); 
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const parentId = searchParams.get('parentId');

  // State HANYA untuk UI loading & File (File susah divalidasi zod client-side murni dengan rapi)
  const [loading, setLoading] = useState(false);
  const [parentTitle, setParentTitle] = useState("Loading...");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // [BARU] Setup React Hook Form
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      instructions: "",
      points: 100,
      dueDate: "",
    },
  });

  // Fetch Parent Title
  useEffect(() => {
    const fetchParent = async () => {
      if (!parentId) return;
      const docRef = doc(db, "modules", parentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setParentTitle(docSnap.data().title);
      }
    };
    fetchParent();
  }, [parentId]);

  // Upload Logic (Tetap sama)
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
  };

  // [BARU] Centralized Submit Handler
  const onSubmit = async (data: AssignmentFormValues, status: 'draft' | 'published') => {
    if (!parentId) return alert("Error: Tidak tahu tugas ini masuk subchapter mana.");

    setLoading(true);
    try {
      let fileUrl = "";
      
      if (selectedFile) {
        setIsUploading(true);
        fileUrl = await uploadFile(selectedFile);
        setIsUploading(false);
      }

      await addDoc(collection(db, "modules"), {
        classId: id,
        parentId: parentId, 
        type: "assignment",
        title: data.title,             // Ambil dari form data
        instructions: data.instructions, // Ambil dari form data
        points: data.points,           // Ambil dari form data (sudah number)
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        fileUrl: fileUrl,
        status: status, 
        createdAt: serverTimestamp(),
      });

      const message = status === 'published' ? "Tugas berhasil diterbitkan!" : "Tugas disimpan sebagai draft.";
      alert(message);
      router.push(`/class/${id}/activity`); 
      
    } catch (error) {
      console.error("Error creating assignment:", error);
      alert("Gagal menyimpan tugas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      
      {/* Bungkus seluruh area dengan Form Provider */}
      <Form {...form}>
        <form>
          {/* HEADER NAVIGASI */}
          <div className="border-b px-6 py-4 flex justify-between items-center sticky top-0 bg-white z-50 shadow-sm">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" type="button" onClick={() => router.back()}>
                <X className="h-6 w-6 text-gray-500" />
              </Button>
              <div className="flex flex-col">
                <h1 className="text-xl font-medium text-gray-800">Tugas Baru</h1>
                <span className="text-xs text-gray-500">di {parentTitle}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* TOMBOL SAVE AS DRAFT */}
              {/* Perhatikan: kita pakai handleSubmit dari form, lalu panggil fungsi kita */}
              <Button 
                variant="outline"
                type="button" 
                onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))}
                disabled={loading || isUploading}
                className="text-gray-600 border-gray-300 hover:bg-gray-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Draft
              </Button>

              {/* TOMBOL PUBLISH */}
              <Button 
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, 'published'))}
                disabled={loading || isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium"
              >
                {loading || isUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Proses...</>
                ) : "Tugaskan"}
              </Button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* KOLOM KIRI (Konten Utama) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* FIELD JUDUL */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="bg-gray-50 p-6 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Label className="text-xs text-gray-400 uppercase tracking-wide font-bold">Judul Tugas</Label>
                    <FormControl>
                      <Input 
                        placeholder="Contoh: Latihan Soal Aljabar Bab 1" 
                        className="text-xl font-medium border-none bg-transparent shadow-none px-0 focus-visible:ring-0 mt-2 h-auto placeholder:text-gray-300"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-red-500 text-xs mt-1" />
                  </FormItem>
                )}
              />

              {/* FIELD INSTRUKSI */}
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem className="bg-gray-50 p-6 rounded-xl border border-gray-100 h-80 flex flex-col focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Label className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">Instruksi / Soal</Label>
                    <FormControl>
                      <Textarea 
                        placeholder="Tuliskan detail instruksi tugas di sini..."
                        className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-0 resize-none text-base leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* UPLOAD ATTACHMENT (Manual State) */}
              <div className="group border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-all relative cursor-pointer">
                  <input 
                    type="file" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  {selectedFile ? (
                    <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border z-20">
                      <div className="bg-blue-100 p-2 rounded">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-gray-800">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB • Siap Upload</p>
                      </div>
                      <Button variant="ghost" size="sm" type="button" className="ml-2 text-red-500 hover:text-red-600" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-100 p-3 rounded-full mb-3 group-hover:bg-blue-200 transition-colors">
                        <UploadCloud className="h-6 w-6 text-gray-400 group-hover:text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Upload Lampiran Soal</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Word, atau Gambar (Max 10MB)</p>
                    </>
                  )}
              </div>
            </div>

            {/* KOLOM KANAN (Sidebar Pengaturan) */}
            <div className="space-y-6">
              
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-6">
                <h3 className="font-semibold text-gray-800 border-b pb-2">Pengaturan Tugas</h3>

                {/* FIELD POIN */}
                <FormField
                  control={form.control}
                  name="points"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-xs font-bold text-gray-500 uppercase">Poin Maksimal</Label>
                      <div className="flex items-center mt-2 border rounded-md px-3 bg-gray-50">
                        <span className="text-gray-500 text-sm font-medium">Pts</span>
                        <FormControl>
                          <Input 
                            type="number" 
                            className="border-none shadow-none focus-visible:ring-0 bg-transparent text-right font-medium"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs text-red-500" />
                    </FormItem>
                  )}
                />

                {/* FIELD DEADLINE */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-xs font-bold text-gray-500 uppercase">Tenggat Waktu</Label>
                      <FormControl>
                        <Input 
                          type="datetime-local"
                          className="mt-2 block w-full bg-gray-50 border-gray-200" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Info Subchapter (Read Only) */}
                <div className="pt-4 border-t">
                    <p className="text-xs text-gray-400 mb-1">Akan diposting di:</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded">
                      <span className="text-blue-500">📂</span> {parentTitle}
                    </div>
                </div>
              </div>

            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}