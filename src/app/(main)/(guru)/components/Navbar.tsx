'use client';

import Image from "next/image"
import { usePathname, useParams } from "next/navigation"
import Link from "next/link";
import SettingsDropdown from "./Settings";
import { cn } from "@/lib/utils";

export default function Navbar() {
    const pathname = usePathname();
    const params = useParams();
    
    // Ambil ID kelas jika ada
    const classId = params?.id as string;
    
    // Cek apakah user sedang berada di dalam rute kelas
    const isClassPage = pathname.startsWith('/class') && classId;

    // Helper untuk style active/inactive agar rapi dan konsisten dengan desainmu
    const getLinkStyle = (isActive: boolean) => {
        return cn(
            "text-b6 font-normal transition-colors", // Base style
            isActive 
                ? "text-blue-base" // Active style (Sesuai desain 'My Class' saat aktif)
                : "hover:text-addition-blue-80" // Inactive hover style
        );
    };

    return(
        // CONTAINER UTAMA (Desain persis: shadow, padding, margin)
        <div className="flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.15)] bg-white px-20 py-9 sticky top-0 z-50">
            
            {/* LOGO SECTION */}
            <div className="flex justify-center items-center gap-2">
                <Image 
                    src={"/Logo.png"}
                    alt="Logo"
                    width={500}
                    height={500}
                    className="w-14 h-12"
                />
                <h1 className="text-h3 font-bold text-blue-base">EduSync</h1>
            </div>

            {/* MENU SECTION */}
            {/* Menggunakan gap-29 sesuai aslimu */}
            <div className="flex items-center justify-center gap-29">
                
                {isClassPage ? (
                    // === MENU KHUSUS KELAS ===
                    <div className="flex gap-29"> {/* Gap antar menu kelas */}
                        {/* 1. Homepage */}
                        <Link href={`/class/${classId}`}>
                            <h1 className={getLinkStyle(pathname === `/class/${classId}`)}>
                                Homepage
                            </h1>
                        </Link>

                        {/* 2. Activity */}
                        <Link href={`/class/${classId}/activity`}>
                            <h1 className={getLinkStyle(pathname.includes('/activity'))}>
                                Activity
                            </h1>
                        </Link>

                        {/* 3. My Students */}
                        <Link href={`/class/${classId}/my-students`}>
                            <h1 className={getLinkStyle(pathname.includes('/my-students'))}>
                                My Students
                            </h1>
                        </Link>
                    </div>
                ) : (
                    // === MENU DASHBOARD UTAMA (Desain Asli) ===
                    <Link href={"/dashboard-guru"}>
                        <h1 className={getLinkStyle(pathname === '/dashboard-guru')}>
                            My Class
                        </h1>
                    </Link>
                )}

                {/* SETTINGS (Selalu ada) */}
                <SettingsDropdown />
            </div>
        </div>
    )
}