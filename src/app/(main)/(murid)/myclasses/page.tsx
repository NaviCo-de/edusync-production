"use client";

import { useEffect, useState, useRef } from "react";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  serverTimestamp,
  doc,
  getDoc
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
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

// --- 1. MODEL DATA (INTERFACES) ---

interface Attachment {
  name: string;
  url: string;
  type: string;
}

// Format Data Raw dari Database (Nested dalam Array)
interface AssignmentFromDB {
  id: string;
  title: string;
  description: string; 
  deadline: string;    
  questionFileUrl?: string; 
  publishedAt?: string; 
  status?: string;
}

// Format Data Gabungan untuk UI
interface AssignmentUI {
  id: string; // Assignment ID
  classId: string;
  className: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  createdAt?: any;
  attachments?: Attachment[];
  points: number; 
  
  // Submission Status (Digabung dari collection submissions)
  submissionStatus: "On Going" | "Submitted" | "Graded";
  submissionId?: string;
  myScore?: number;
  submittedAt?: any;
  submittedFileName?: string;
  submittedFileUrl?: string;
}

// Collection: 'submissions' (Root Collection)
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
      // Tunggu user profile loaded
      if (!user || !user.uid || !user.daftarKelas) {
        if (!userLoading) setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        // A. AMBIL DATA ASSIGNMENTS (NESTED LOOP)
        // Struktur: Classes -> Chapters -> Subchapters[] -> Assignments[]
        const assignmentsPromises = user.daftarKelas.map(async (classId) => {
          // 1. Ambil Nama Kelas
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          const className = classSnap.exists() ? classSnap.data().name : "Unknown Class";

          // 2. Ambil Chapters
          const chaptersRef = collection(db, "classes", classId, "chapters");
          const chaptersSnap = await getDocs(chaptersRef);

          const classAssignments: AssignmentUI[] = [];

          chaptersSnap.docs.forEach((chapterDoc) => {
            const chapterData = chapterDoc.data();
            
            // 3. Loop Subchapters Array
            if (chapterData.subchapters && Array.isArray(chapterData.subchapters)) {
              chapterData.subchapters.forEach((sub: any) => {
                
                // 4. Loop Assignments Array
                if (sub.assignments && Array.isArray(sub.assignments)) {
                  sub.assignments.forEach((assign: AssignmentFromDB) => {
                    
                    // Filter: Hanya tampilkan jika status published (atau tidak ada status)
                    if (assign.status === "published" || !assign.status) {
                      
                      // Convert single url string ke array object attachment agar UI rapi
                      const attachmentsList: Attachment[] = assign.questionFileUrl 
                        ? [{ name: "Material.pdf", url: assign.questionFileUrl, type: "file" }]
                        : [];

                      classAssignments.push({
                        id: assign.id,
                        classId: classId,
                        className: className,
                        title: assign.title,
                        instructions: assign.description || "No instructions provided.",
                        dueDate: assign.deadline || null,
                        createdAt: assign.publishedAt || new Date().toISOString(),
                        attachments: attachmentsList,
                        points: 100, // Default score max
                        submissionStatus: "On Going" // Default sebelum di-merge
                      });
                    }
                  });
                }
              });
            }
          });
          return classAssignments;
        });

        // Tunggu semua kelas selesai diloop
        const nestedAssignmentsResult = (await Promise.all(assignmentsPromises)).flat();

        // B. AMBIL DATA SUBMISSIONS (ROOT COLLECTION)
        // Cukup satu query simpel ke root collection 'submissions' berdasarkan studentId
        const qSubmissions = query(
          collection(db, "submissions"),
          where("studentId", "==", user.uid)
        );
        const snapSubmissions = await getDocs(qSubmissions);
        const mySubmissions = snapSubmissions.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubmissionData));

        // C. MERGE DATA (GABUNGKAN)
        const finalData: AssignmentUI[] = nestedAssignmentsResult.map((assign) => {
          // Cari apakah ada submission untuk assignmentId ini
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
            submittedFileName: sub?.fileName,
            submittedFileUrl: sub?.fileUrl
          };
        });

        // Sort by Deadline (Terdekat dulu)
        finalData.sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return dateA - dateB;
        });

        setAssignments(finalData);
        
        // Auto-select logic
        if (finalData.length > 0) {
           // Coba pilih yang masih On Going dulu, kalau gak ada ambil yang pertama
           const firstPriority = finalData.find(f => f.submissionStatus === "On Going") || finalData[0];
           setSelectedAssignment(firstPriority);
        }

      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast.error("Gagal memuat daftar tugas.");
      } finally {
        setLoadingData(false);
      }
    };

    if (!userLoading) {
        fetchData();
    }
  }, [user, userLoading]);

  // --- 3. SUBMISSION LOGIC (ROOT COLLECTION + CHECK EXISTING) ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssignment || !user) return;

    if (file.size > 10 * 1024 * 1024) { 
      toast.error("File terlalu besar (Maks 10MB)");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload ke Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
      
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) throw new Error("Cloudinary Config Missing");

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error?.message || "Gagal upload ke server");
      }

      const uploadData = await uploadRes.json();
      const realFileUrl = uploadData.secure_url; 
      
      // 2. Cek apakah submission sudah ada (untuk Update) atau belum (untuk Create)
      // Query ke ROOT collection 'submissions'
      const qExisting = query(
        collection(db, "submissions"),
        where("assignmentId", "==", selectedAssignment.id),
        where("studentId", "==", user.uid)
      );
      const existingSnap = await getDocs(qExisting);

      let submissionDocId = "";

      if (!existingSnap.empty) {
        // CASE: UPDATE (Sudah pernah submit, ganti file)
        const oldDoc = existingSnap.docs[0];
        submissionDocId = oldDoc.id;
        
        await updateDoc(doc(db, "submissions", submissionDocId), {
            fileUrl: realFileUrl,
            fileName: file.name,
            submittedAt: serverTimestamp(),
            status: "SUBMITTED" // Reset status jadi submitted jika sebelumnya graded/late
        });
        toast.success("Submission updated successfully!");
      } else {
        // CASE: CREATE (Baru pertama kali submit)
        const newSubmission: Omit<SubmissionData, 'id'> = {
            assignmentId: selectedAssignment.id,
            studentId: user.uid,
            studentName: user.nama || "Student",
            status: "SUBMITTED",
            submittedAt: serverTimestamp(),
            fileUrl: realFileUrl,
            fileName: file.name
        };
        const docRef = await addDoc(collection(db, "submissions"), newSubmission);
        submissionDocId = docRef.id;
        toast.success("Assignment submitted successfully!");
      }

      // 3. Optimistic UI Update (Tanpa reload page)
      const updatedAssignment: AssignmentUI = {
        ...selectedAssignment,
        submissionStatus: "Submitted",
        submissionId: submissionDocId,
        submittedFileName: file.name,
        submittedFileUrl: realFileUrl,
        submittedAt: new Date()
      };

      setAssignments(prev => 
        prev.map(a => a.id === selectedAssignment.id ? updatedAssignment : a)
      );
      setSelectedAssignment(updatedAssignment);
      setFilterStatus("Submitted");

    } catch (error: any) {
      console.error("Gagal submit:", error);
      toast.error(`Error: ${error.message}`);
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

  const formatDateTime = (dateInput: any) => {
    if(!dateInput) return "-";
    const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    return date.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) + 
           " - " + 
           date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  };

  if (userLoading || loadingData) return <AssignmentsSkeleton />;

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 md:p-12 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-8 mb-10">
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
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-4">
            <h2 className="text-2xl font-bold text-black">My Assignments</h2>
            
            <div className="flex gap-3 bg-transparent">
                {(["On Going", "Submitted", "Graded"] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => {
                            setFilterStatus(status);
                            const first = assignments.find(a => a.submissionStatus === status);
                            setSelectedAssignment(first || null);
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
        
        {/* LEFT COLUMN: LIST TUGAS */}
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
                {selectedAssignment?.id === assign.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-base" />
                )}

                <div className="mb-2">
                  <span className="bg-blue-base text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    {assign.className}
                  </span>
                </div>
                
                <h3 className="font-bold text-lg mb-1 line-clamp-2 text-[#494B55]">
                    {assign.title}
                </h3>
                
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                   Deadline: {assign.dueDate ? formatDateTime(assign.dueDate) : "No Deadline"}
                </p>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: DETAIL TUGAS */}
        <div className="lg:col-span-8">
          {selectedAssignment ? (
            <div className="bg-white rounded-[30px] p-10 shadow-sm min-h-[600px] flex flex-col relative">
              
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-black mb-1">{selectedAssignment.title}</h2>
                <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-black">
                    Due Date: {selectedAssignment.dueDate ? formatDateTime(selectedAssignment.dueDate) : "No Deadline"}
                    </p>
                    {selectedAssignment.myScore !== undefined && (
                        <Badge className="text-lg bg-blue-base">Score: {selectedAssignment.myScore}</Badge>
                    )}
                </div>
              </div>

              <div className="text-sm text-[#494B55] leading-relaxed mb-8 whitespace-pre-line">
                {selectedAssignment.instructions}
              </div>

              {/* Attachments (Soal) */}
              <div className="space-y-3 mb-10">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reference Materials</h4>
                {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 ? (
                    selectedAssignment.attachments.map((file, idx) => (
                        <a 
                            key={idx} 
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 group cursor-pointer p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors w-max"
                        >
                            <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-full">
                                <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-black group-hover:underline truncate max-w-[200px]">
                                    {file.name}
                                </span>
                                <span className="text-[10px] text-gray-400">Click to open</span>
                            </div>
                        </a>
                    ))
                ) : (
                    <p className="text-sm text-gray-400 italic">No attachments provided.</p>
                )}
              </div>

              <div className="border-t border-gray-200 w-full mb-6"></div>

              {/* Footer Info */}
              <div className="w-full">
                <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-black text-sm">Status</span>
                    <span className="text-sm text-black font-medium">
                        {selectedAssignment.submissionStatus === "On Going" ? "Not Submitted" : 
                         selectedAssignment.submissionStatus === "Submitted" ? "Submitted (Waiting for Grade)" : "Graded"}
                    </span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-black text-sm">Remaining Time</span>
                    <span className="text-sm text-black font-medium">
                        {selectedAssignment.submissionStatus === "On Going" 
                            ? getTimeRemaining(selectedAssignment.dueDate)
                            : "Completed"}
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
                    <div className="flex flex-col items-center gap-3 w-full bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 text-green-600">
                             <CheckCircle className="w-6 h-6" />
                             <span className="font-bold">Work Submitted</span>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <a href={selectedAssignment.submittedFileUrl} target="_blank" className="text-sm text-blue-600 hover:underline font-medium">
                                {selectedAssignment.submittedFileName || "View File"}
                            </a>
                        </div>
                        
                        {selectedAssignment.submissionStatus !== "Graded" && (
                            <Button variant="link" onClick={triggerFileUpload} className="text-xs text-gray-400 hover:text-gray-600">
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                                Resubmit File
                            </Button>
                        )}
                    </div>
                )}
              </div>

            </div>
          ) : (
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