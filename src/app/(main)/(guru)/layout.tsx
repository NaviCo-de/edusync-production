import Navbar from "./components/Navbar";

export default function MuridLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#F8F9FC] w-full min-h-screen">
        <Navbar />
        {children}
    </div>
  )
}
