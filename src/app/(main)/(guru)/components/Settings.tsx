'use client';

import { useState } from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { generateClassCode } from "@/lib/utils";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import ClassImageUpload from './ClassImageUpload';
import Image from "next/image";

interface SettingsDropdownProps {
  onClassCreated?: () => void; // Callback untuk refresh data kelas di dashboard
}

export default function SettingsDropdown({ onClassCreated }: SettingsDropdownProps) {
    const router = useRouter();
    const { user } = useUserProfile();
    
    // Dialog State
    const [open, setOpen] = useState(false);
    const [className, setClassName] = useState("");
    const [classImage, setClassImage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log("User logged out");
            router.push("/login");
        } catch (error) {
            console.error("Gagal logout:", error);
        }
    };

    const handleCreateClass = async () => {
        if (!className) return alert("Nama kelas wajib diisi!");
        if (!classImage) return alert("Upload logo kelas dulu!");
        if (!user) return alert("User tidak ditemukan");

        setIsSubmitting(true);

        try {
            const code = generateClassCode();

            await addDoc(collection(db, "classes"), {
                name: className,
                imageUrl: classImage,
                teacherId: user.uid,
                teacherName: user.nama,
                code: code,
                studentCount: 0,
                description: "Belum ada deskripsi kelas.",
                createdAt: serverTimestamp(),
            });

            setOpen(false);
            setClassName("");
            setClassImage("");
            
            // Callback untuk refresh data di dashboard
            if (onClassCreated) {
                onClassCreated();
            }
            
        } catch (error) {
            console.error("Error creating class:", error);
            alert("Gagal membuat kelas. Cek console.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className="flex justify-center items-center gap-2 cursor-pointer">
                        <span className="text-b6 font-normal hover:text-addition-blue-80">Settings</span>
                        <Image 
                            src={'/chevron_down.png'}
                            alt="chevron down"
                            width={34}
                            height={10}
                            className="w-7 h-4"
                        />
                    </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">                    
                    <DropdownMenuItem 
                        className="cursor-pointer" 
                        onClick={() => router.push('/profile')}
                    >
                        <span>Profil</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        className="cursor-pointer" 
                        onClick={() => setOpen(true)}
                    >
                        <span>Buat Kelas Baru</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={handleLogout}
                    >
                        <span>Log Out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialog Create Class */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Buat Kelas Baru</DialogTitle>
                        <DialogDescription>
                            Isi data kelas. Kode kelas akan digenerate otomatis.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nama Kelas</Label>
                            <Input
                                id="name"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                placeholder="Contoh: Matematika X-2"
                            />
                        </div>
                        <ClassImageUpload onUploadComplete={(url) => setClassImage(url)} />
                    </div>
                    <DialogFooter>
                        <Button 
                            onClick={handleCreateClass} 
                            disabled={isSubmitting}
                            className="rounded-[20px] px-5 py-4 text-b7 text-white font-semibold w-fit h-fit bg-blue-base"
                        >
                            {isSubmitting ? "Menyimpan..." : "Simpan Kelas"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}