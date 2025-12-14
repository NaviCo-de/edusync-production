"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input"; //
import { Label } from "@/components/ui/label"; //

interface ClassImageUploadProps {
  onUploadComplete: (url: string) => void;
}

export default function ClassImageUpload({ onUploadComplete }: ClassImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    // Pastikan variable env ini ada!
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      
      if (data.secure_url) {
        setFileName(file.name);
        setPreview(data.secure_url);
        onUploadComplete(data.secure_url); // Kirim URL ke parent (Dialog)
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Gagal upload gambar kelas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label>Logo Kelas</Label>
      <label 
        htmlFor="picture" 
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {fileName ? (
            <>
              <p className="text-sm text-slate-500"><span className="font-semibold">{fileName}</span></p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500"><span className="font-semibold">Klik untuk upload</span></p>
            </>
          )}
        </div>
        <Input id="picture" type="file" onChange={handleFileChange} disabled={loading} accept="image/*" className="hidden"/>
      </label>
      {loading && <p className="text-xs text-muted-foreground">Sedang upload...</p>}
      {preview && (
        <div className="mt-2 flex flex-col gap-2">
          <p>Preview:</p>
          <img src={preview} alt="Preview" className="h-20 w-20 object-cover rounded-md border" />
        </div>
      )}
    </div>
  );
}