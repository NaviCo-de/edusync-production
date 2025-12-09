'use client';

import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";

export default function SettingsDropdown() {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log("User logged out")
            router.push("/login");
        } catch (error) {
            console.error("Gagal logout:", error)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex justify-center items-center gap-2">
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
                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={handleLogout}
                >
                    <span>Log Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>

        </DropdownMenu>
    )
}