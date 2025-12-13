import Navbar from "./components/Navbar";
import { Toaster } from "sonner";
export default function MuridLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#F8F9FC] w-full min-h-screen">
        <Navbar />
        {children}
        <Toaster position="top-center" richColors />
    </div>
  )
}
