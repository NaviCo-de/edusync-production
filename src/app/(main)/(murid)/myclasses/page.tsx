"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import { toast } from "sonner"; 

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Bell, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  UploadCloud, 
  Loader2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { id as ind } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

// --- 1. MODEL DATA (KONTRAK) ---

interface Attachment {
  name: string;
  url: string;
  type: string;
}

// Collection: 'modules' (Soal dari Guru)
interface AssignmentModule {
  id: string;
  classId: string;
  className?: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  createdAt?: any; // Untuk "Published on"
  attachments?: Attachment[];
  points: number; 
}

// Collection: 'submissions' (Jawaban Murid)
interface SubmissionData {
  id: string;
  assignmentId: string; 
  studentId: string;    
  studentName?: string; 
  status: "SUBMITTED" | "GRADED" | "LATE";
  submittedAt: any;
  fileUrl: string;      
  fileName: string;     
  score?: number;       
  feedback?: string;    
}

// Gabungan untuk UI State
interface AssignmentUI extends AssignmentModule {
  submissionStatus: "On Going" | "Submitted" | "Graded";
  submissionId?: string;
  myScore?: number;
  submittedAt?: any;
  submittedFileName?: string;
}

export default function MyAssignmentsPage() {
  const { user, loading: userLoading } = useUserProfile();
  
  // State
  const [assignments, setAssignments] = useState<AssignmentUI[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentUI | null>(null);
  const [filterStatus, setFilterStatus] = useState<"On Going" | "Submitted" | "Graded">("On Going");

  // Ref untuk input file
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 2. DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.uid || !user.daftarKelas) {
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        // A. Ambil Tugas (Modules)
        const assignmentsPromises = user.daftarKelas.map(async (classId) => {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          const className = classSnap.exists() ? classSnap.data().name : "Unknown Class";

          // PERBAIKAN: Query disederhanakan ke 'classId' saja.
          // Filter 'type' dan 'status' dipindah ke Javascript (Client-side).
          // Alasannya: Query multiple 'where' di Firestore MEMBUTUHKAN Composite Index.
          // Jika Index belum dibuat di Console Firebase, query akan gagal total (return 0).
          const qModules = query(
            collection(db, "modules"),
            where("classId", "==", classId)
          );
          
          const snapModules = await getDocs(qModules);
          
          // Filter di sini (Memory)
          const filteredDocs = snapModules.docs.filter(doc => {
            const data = doc.data();
            // Pastikan ini assignment & statusnya published
            // Kita gunakan logic agak longgar: jika status tidak ada, anggap published (biar muncul dulu)
            return data.type === "assignment" && (data.status === "published" || !data.status);
          });
          
          return filteredDocs.map(doc => ({
            id: doc.id,
            className,
            ...doc.data()
          } as AssignmentModule));
        });

        const assignmentsResult = (await Promise.all(assignmentsPromises)).flat();

        // B. Ambil Submission Saya
        const qSubmissions = query(
          collection(db, "submissions"),
          where("studentId", "==", user.uid)
        );
        const snapSubmissions = await getDocs(qSubmissions);
        const mySubmissions = snapSubmissions.docs.map(doc => doc.data() as SubmissionData);

        // C. Gabungkan (Merge)
        const finalData: AssignmentUI[] = assignmentsResult.map((assign) => {
          const sub = mySubmissions.find((s) => s.assignmentId === assign.id);
          
          let status: "On Going" | "Submitted" | "Graded" = "On Going";
          if (sub) {
            status = sub.status === "GRADED" ? "Graded" : "Submitted";
          }

          return {
            ...assign,
            submissionStatus: status,
            submissionId: sub?.id,
            myScore: sub?.score,
            submittedAt: sub?.submittedAt,
            submittedFileName: sub?.fileName
          };
        });

        // Sort: Deadline terdekat
        finalData.sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            return dateA - dateB;
        });

        setAssignments(finalData);
        
        // Auto-select item pertama yang sesuai filter
        if (finalData.length > 0) {
            const firstItem = finalData.find(f => f.submissionStatus === "On Going") || finalData[0];
            setSelectedAssignment(firstItem);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (!userLoading) {
        fetchData();
    }
  }, [user, userLoading]);

  // --- 3. SUBMISSION LOGIC (Real Cloudinary Upload) ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssignment || !user) return;

    if (file.size > 10 * 1024 * 1024) { // Limit 10MB
      toast.error("File terlalu besar (Maks 10MB)");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Persiapan Upload ke Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
      
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) throw new Error("Cloudinary Config Missing");

      // Gunakan 'auto' resource type agar support PDF, Doc, Image, dll
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error?.message || "Gagal upload ke server");
      }

      const uploadData = await uploadRes.json();
      const realFileUrl = uploadData.secure_url; // URL asli dari Cloudinary
      
      // 2. Buat Object Submission dengan URL asli
      const newSubmission: Omit<SubmissionData, 'id'> = {
        assignmentId: selectedAssignment.id,
        studentId: user.uid,
        studentName: user.nama || "Siswa",
        status: "SUBMITTED",
        submittedAt: serverTimestamp(),
        fileUrl: realFileUrl, // Pakai URL dari Cloudinary
        fileName: file.name,
        score: undefined
      };

      // 3. Simpan data submission ke Firestore
      const docRef = await addDoc(collection(db, "submissions"), newSubmission);

      // 4. Update UI State (Optimistic Update)
      const updatedAssignment: AssignmentUI = {
        ...selectedAssignment,
        submissionStatus: "Submitted",
        submissionId: docRef.id,
        submittedFileName: file.name,
        submittedAt: new Date()
      };

      setAssignments(prev => 
        prev.map(a => a.id === selectedAssignment.id ? updatedAssignment : a)
      );
      setSelectedAssignment(updatedAssignment);
      setFilterStatus("Submitted");
      
      toast.success("Tugas berhasil dikumpulkan!");

    } catch (error: any) {
      console.error("Gagal submit:", error);
      toast.error(`Gagal upload: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // --- 4. RENDER HELPERS ---
  const filteredAssignments = assignments.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.className?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = item.submissionStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getTimeRemaining = (dateString: string | null) => {
    if (!dateString) return "No Deadline";
    const due = new Date(dateString);
    const now = new Date();
    if (now > due) return "Overdue";
    return formatDistanceToNow(due, { addSuffix: false }) + " left";
  };

  // Format Date: "09 Nov 2025 - 09:30"
  const formatPublishedDate = (timestamp: any) => {
    if(!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) + " - " + date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  };

  if (userLoading || loadingData) return <AssignmentsSkeleton />;

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 md:p-12 font-sans">
      
      {/* HEADER SECTION - 1:1 Design */}
      <div className="flex flex-col gap-8 mb-10">
        
        {/* Top Bar: Title & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <h1 className="text-[42px] font-bold text-blue-base tracking-tight leading-none">
                Let&rsquo;s Back On Track!
            </h1>

            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-[400px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="Search Material" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 py-6 rounded-[20px] bg-white border-none shadow-sm text-sm"
                    />
                </div>
                <Button size="icon" className="w-12 h-12 rounded-full bg-blue-10 hover:bg-blue-20 text-blue-base shadow-sm">
                    <Bell className="h-5 w-5" />
                </Button>
            </div>
        </div>

        {/* Sub Header: My Assignments & Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-4">
            <h2 className="text-2xl font-bold text-black">My Assignments</h2>
            
            <div className="flex gap-3 bg-transparent">
                {(["On Going", "Submitted", "Graded"] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => {
                            setFilterStatus(status);
                            const first = assignments.find(a => a.submissionStatus === status);
                            if(first) setSelectedAssignment(first);
                            else setSelectedAssignment(null);
                        }}
                        className={cn(
                            "px-6 py-2 rounded-full text-sm font-bold transition-all",
                            filterStatus === status 
                                ? "bg-[#80711A] text-white shadow-md" 
                                : "bg-[#D4BB2B] text-white hover:bg-[#80711A]/80"
                        )}
                    >
                        {status}
                    </button>
                ))}
            </div>
        </div>

      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: LIST TUGAS (4 Kolom) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300"/>
                <p className="text-gray-400 text-sm">No assignments found</p>
            </div>
          ) : (
            filteredAssignments.map((assign) => (
              <div
                key={assign.id}
                onClick={() => setSelectedAssignment(assign)}
                className={cn(
                  "p-6 rounded-2xl cursor-pointer transition-all bg-white relative overflow-hidden group border",
                  selectedAssignment?.id === assign.id 
                    ? "border-transparent shadow-md ring-2 ring-blue-base/10" 
                    : "border-transparent hover:shadow-md"
                )}
              >
                {/* Blue Indicator for Active Item */}
                {selectedAssignment?.id === assign.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-base" />
                )}

                <div className="mb-2">
                  <span className="bg-blue-base text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    {assign.className || "Course"}
                  </span>
                </div>
                
                <h3 className={cn(
                    "font-bold text-lg mb-1 line-clamp-2 text-[#494B55]", // Warna text abu gelap
                )}>
                    {assign.title}
                </h3>
                
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                    Published on {formatPublishedDate(assign.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: DETAIL TUGAS (8 Kolom) */}
        <div className="lg:col-span-8">
          {selectedAssignment ? (
            <div className="bg-white rounded-[30px] p-10 shadow-sm min-h-[600px] flex flex-col relative">
              
              {/* Title & Deadline */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-black mb-1">{selectedAssignment.title}</h2>
                <p className="text-sm font-medium text-black">
                  Deadline on {selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "-"} - {selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }) : ""}
                </p>
              </div>

              {/* Description */}
              <div className="text-sm text-[#494B55] leading-relaxed mb-8 whitespace-pre-line">
                {selectedAssignment.instructions || "No instructions provided."}
              </div>

              {/* Attachments */}
              <div className="space-y-3 mb-10">
                {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 ? (
                    selectedAssignment.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 group cursor-pointer">
                            <div className="w-6 h-6 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-black" />
                            </div>
                            <span className="text-sm font-medium text-black group-hover:underline">
                                {file.name}
                            </span>
                        </div>
                    ))
                ) : (
                    // Default Mockup jika tidak ada attachment (sesuai screenshot)
                    <>
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-black" />
                            <span className="text-sm font-medium text-black">Pembagian Kelompok.pdf</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-black" />
                            <span className="text-sm font-medium text-black">Soal TK2 Kalkulus Sem Gasal.pdf</span>
                        </div>
                    </>
                )}
              </div>

              <div className="border-t border-gray-200 w-full mb-6"></div>

              {/* Footer Info Table Style */}
              <div className="w-full">
                <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-black text-sm">Submission Status</span>
                    <span className="text-sm text-black font-medium">
                        {selectedAssignment.submissionStatus === "On Going" ? "No Attempt" : 
                         selectedAssignment.submissionStatus === "Submitted" ? "Submitted for Grading" : "Graded"}
                    </span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-black text-sm">Time Remaining</span>
                    <span className="text-sm text-black font-medium">
                        {selectedAssignment.submissionStatus === "On Going" 
                            ? getTimeRemaining(selectedAssignment.dueDate)
                            : "Assignment Completed"}
                    </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 flex justify-center">
                {selectedAssignment.submissionStatus === "On Going" ? (
                    <>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.zip,.jpg,.png"
                        />
                        <Button 
                            className="bg-blue-base hover:bg-blue-700 text-white rounded-[15px] px-8 py-6 text-sm font-semibold shadow-lg shadow-blue-200/50 min-w-[200px]"
                            onClick={triggerFileUpload}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                            ) : (
                                <><Plus className="w-5 h-5 mr-2" /> Add Submission</>
                            )}
                        </Button>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-4 py-2 text-sm">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {selectedAssignment.submissionStatus === "Graded" 
                                ? `Graded: ${selectedAssignment.myScore}/${selectedAssignment.points}` 
                                : "Submitted"}
                        </Badge>
                        <p className="text-xs text-gray-400">File: {selectedAssignment.submittedFileName}</p>
                    </div>
                )}
              </div>

            </div>
          ) : (
            // Empty State Kanan
            <div className="bg-white rounded-[30px] p-10 shadow-sm min-h-[600px] flex flex-col items-center justify-center text-gray-400">
                <div className="bg-gray-50 p-6 rounded-full mb-4">
                    <AlertCircle className="w-12 h-12 text-gray-300" />
                </div>
                <p>Select an assignment to view details</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function AssignmentsSkeleton() {
    return (
        <div className="min-h-screen bg-[#F8F9FC] p-6 md:p-12">
            <div className="flex justify-between mb-10">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <div className="flex gap-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                    ))}
                </div>
                <div className="md:col-span-8">
                    <Skeleton className="h-[600px] w-full rounded-[30px]" />
                </div>
            </div>
        </div>
    )
}