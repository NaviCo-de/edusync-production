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
      <Input type="file" onChange={handleFileChange} disabled={loading} accept="image/*" />
      {loading && <p className="text-xs text-muted-foreground">Sedang upload ke Cloudinary...</p>}
      {preview && (
        <div className="mt-2">
           <img src={preview} alt="Preview" className="h-20 w-20 object-cover rounded-md border" />
        </div>
      )}
    </div>
  );
}