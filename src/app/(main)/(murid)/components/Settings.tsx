'use client';

import { useState } from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Image from "next/image";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  setDoc,
  serverTimestamp 
} from "firebase/firestore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/lib/hooks/useUserProfile";

export default function SettingsDropdown() {
    const router = useRouter();
    const { user } = useUserProfile();
    
    // State Modal Join
    const [open, setOpen] = useState(false);
    const [inputCode, setInputCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log("User logged out")
            router.push("/login");
        } catch (error) {
            console.error("Gagal logout:", error)
        }
    }

    const handleJoinClass = async () => {
        if (!inputCode || !user) return;
        setIsJoining(true);

        try {
            const classesRef = collection(db, "classes"); 
            const q = query(classesRef, where("code", "==", inputCode)); 
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast.error("Kelas tidak ditemukan");
                setIsJoining(false);
                return;
            }

            const classDoc = querySnapshot.docs[0];
            const classId = classDoc.id;
            const classData = classDoc.data();

            if (user?.daftarKelas?.includes(classId)) {
                toast.warning("Sudah Bergabung");
                setIsJoining(false);
                return;
            }

            await Promise.all([
                setDoc(doc(db, "classes", classId, "students", user.uid), {
                    uid: user.uid,
                    nama: user.nama,
                    email: user.email,
                    role: "MURID", 
                    joinedAt: serverTimestamp(),
                }),
                updateDoc(doc(db, "users", user.uid), {
                    daftarKelas: arrayUnion(classId) 
                })
            ]);

            setOpen(false);
            setInputCode("");
            toast.success(`Berhasil bergabung ke ${classData.name}`);
            window.location.reload(); 

        } catch (err) {
            console.error(err);
            toast.error("Gagal Bergabung");
        } finally {
            setIsJoining(false);
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

                <DropdownMenuContent align="end">
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
                        <span>Join Class</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={handleLogout}
                    >
                        <span>Log Out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* MODAL JOIN CLASS */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                    {/* HEADER */}
                    <div className="bg-white pt-12 pb-8 px-8 text-center">
                        <DialogTitle className="text-4xl font-bold text-black mb-2">
                            Join New Class
                        </DialogTitle>
                    </div>

                    {/* BODY */}
                    <div className="px-12 py-16">
                        <div className="space-y-3 max-w-md mx-auto">
                            <Input
                                variant={"auth"}
                                id="code"
                                placeholder="Input Your Class Code"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                disabled={isJoining}
                            />
                        </div>
                    </div>

                    {/* FOOTER */}
                    <DialogFooter className="bg-white px-12 py-8 flex justify-center">
                        <Button 
                            onClick={handleJoinClass} 
                            disabled={isJoining || !inputCode}
                            className="bg-[#3D5AFE] hover:bg-[#3D5AFE]/90 text-white font-bold px-12 py-6 rounded-full text-base min-w-[200px]"
                        >
                            {isJoining ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...</>
                            ) : (
                                "Join"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}