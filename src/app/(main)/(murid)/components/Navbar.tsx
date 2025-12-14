'use client';

import Image from "next/image"
import { usePathname } from "next/navigation"
import Link from "next/link";
import SettingsDropdown from "./Settings";
import { cn } from "@/lib/utils";

export default function Navbar() {
    const pathname = usePathname();

    return(
        <div className="flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.15)] bg-white px-20 py-9">
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
            <div className="flex items-center justify-center gap-29">
                <Link
                    href={"/dashboard-murid"}
                >
                    {pathname === '/dashboard-murid' ? (
                        <h1 className="text-b6 text-blue-base font-normal">Homepage</h1>
                    ) : (
                        <h1 className="text-b6 font-normal hover:text-addition-blue-80">Homepage</h1>
                    )}
                </Link>

                <Link
                    href={"/myclasses"}
                    className=""
                >
                    {pathname === '/myclasses' ? (
                        <h1 className="text-b6 text-blue-base font-normal">Classes</h1>
                    ) : (
                        <h1 className="text-b6 font-normal hover:text-addition-blue-80">Classes</h1>
                    )}
                </Link>

                <Link
                    href={"/mygrades"}
                    className=""
                >
                    {pathname === '/mygrades' ? (
                        <h1 className="text-b6 text-blue-base font-normal">My Grades</h1>
                    ) : (
                        <h1 className="text-b6 font-normal hover:text-addition-blue-80">My Grades</h1>
                    )}
                </Link>

                <SettingsDropdown />
            </div>
        </div>
    )
}