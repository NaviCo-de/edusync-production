// app/(main)/(guru)/activity/my-assignments/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Status = "On Going" | "Graded";

type Assignment = {
  id: string;
  tag: string;
  title: string;
  publishedAt: string;
  deadlineText: string;
  instructions: string;
  attachments: { name: string; url: string }[];
  submissionCount: number;
  totalStudents: number;

  // internal
  _status: Status;
  _classId: string;
  _chapterId: string;
  _subchapterIndex: number;
  _assignmentIndex: number;
  _assignmentId: string;
  _deadlineAt: Date | null;
  _publishedAt: Date | null;
  _questionFileUrl: string;
  _rubricFileUrl: string;
  _description: string;
};

type ClassDoc = {
  name?: string;
  teacherName?: string;
  studentCount?: number;
};

type ChapterDoc = {
  title?: string;
  subchapters?: Array<{
    title?: string;
    assignments?: Array<{
      id?: string;
      title?: string;
      description?: string;
      status?: string;
      createdAt?: any;
      publishedAt?: any;
      deadline?: any;
      questionFileUrl?: string;
      rubricFileUrl?: string;
    }>;
  }>;
};

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtPublished(d: Date | null): string {
  if (!d) return "Published on -";
  return `Published on ${fmtDateTime(d)}`;
}

function fmtDeadline(d: Date | null): string {
  if (!d) return "Deadline on -";
  return `Deadline on ${fmtDateTime(d)}`;
}

export default function TeacherMyAssignmentsPage() {
  const router = useRouter();

  const [filter, setFilter] = useState<Status>("On Going");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    title: "",
    description: "",
    deadline: "",
  });
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    console.log("🔵 useEffect triggered");
    
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("👤 User:", u?.uid || "No user");
      setCurrentUser(u);
      setLoading(true);

      try {
        if (!u) {
          console.log("❌ No user logged in");
          setAssignments([]);
          setSelectedId("");
          return;
        }

        // Get classes where this user is the teacher
        const classesRef = collection(db, "classes");
        const classesQuery = query(classesRef, where("teacherId", "==", u.uid));
        const classesSnap = await getDocs(classesQuery);
        
        console.log(`🏫 Classes where user is teacher: ${classesSnap.size}`);
        
        const teachingClassIds = classesSnap.docs.map(doc => doc.id);
        console.log("📚 Teaching class IDs:", teachingClassIds);

        if (!teachingClassIds.length) {
          console.log("⚠️ No teaching classes found for this teacher");
          setAssignments([]);
          setSelectedId("");
          return;
        }

        // Fetch all assignments from teaching classes
        const now = new Date();
        const flat: Assignment[] = [];

        for (const classId of teachingClassIds) {
          const classRef = doc(db, "classes", classId);
          const classSnap = await getDoc(classRef);
          const classData = (classSnap.exists() ? classSnap.data() : {}) as ClassDoc;
          const className = classData?.name || "Untitled Class";
          const studentCount = classData?.studentCount || 0;

          // Get chapters
          const chaptersRef = collection(db, "classes", classId, "chapters");
          const chaptersSnap = await getDocs(chaptersRef);

          for (const chapterDoc of chaptersSnap.docs) {
            const chapterData = chapterDoc.data() as ChapterDoc;
            const subchapters = chapterData?.subchapters || [];

            subchapters.forEach((subchapter, subIdx) => {
              const assignmentsArr = subchapter?.assignments || [];

              assignmentsArr.forEach((asg, asgIdx) => {
                const asgId = asg?.id || "";
                if (!asgId) return;

                const deadlineDate = toDateSafe(asg?.deadline);
                const publishedDate = toDateSafe(asg?.publishedAt) || toDateSafe(asg?.createdAt);

                // Determine status based on deadline
                const isPastDeadline = deadlineDate && deadlineDate.getTime() <= now.getTime();
                const status: Status = isPastDeadline ? "Graded" : "On Going";

                const attachments: { name: string; url: string }[] = [];
                if (asg?.questionFileUrl)
                  attachments.push({ name: "Soal.pdf", url: asg.questionFileUrl });
                if (asg?.rubricFileUrl)
                  attachments.push({ name: "Rubrik.pdf", url: asg.rubricFileUrl });

                flat.push({
                  id: `${classId}-${chapterDoc.id}-${subIdx}-${asgIdx}`,
                  tag: className,
                  title: asg?.title || "Untitled Assignment",
                  publishedAt: fmtPublished(publishedDate),
                  deadlineText: fmtDeadline(deadlineDate),
                  instructions: asg?.description || "-",
                  attachments,
                  submissionCount: 0, // Will be calculated from submissions if needed
                  totalStudents: studentCount,
                  _status: status,
                  _classId: classId,
                  _chapterId: chapterDoc.id,
                  _subchapterIndex: subIdx,
                  _assignmentIndex: asgIdx,
                  _assignmentId: asgId,
                  _deadlineAt: deadlineDate,
                  _publishedAt: publishedDate,
                  _questionFileUrl: asg?.questionFileUrl || "",
                  _rubricFileUrl: asg?.rubricFileUrl || "",
                  _description: asg?.description || "",
                });
              });
            });
          }
        }

        // Sort by deadline (nearest first)
        flat.sort((a, b) => {
          const da = a._deadlineAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const db = b._deadlineAt?.getTime() ?? Number.POSITIVE_INFINITY;
          return da - db;
        });

        console.log("✅ Setting assignments to state");
        setAssignments(flat);
        
        // Log untuk debug filtered
        console.log("🔍 Assignments by status:");
        const onGoing = flat.filter(a => a._status === "On Going");
        const graded = flat.filter(a => a._status === "Graded");
        console.log(`  ⏳ On Going: ${onGoing.length}`, onGoing);
        console.log(`  ✅ Graded: ${graded.length}`, graded);
      } catch (error) {
        console.error("❌ Error fetching assignments:", error);
      } finally {
        console.log("🏁 Loading finished");
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
    const endpoint = file.type.startsWith('image/')
      ? `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`
      : `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/raw/upload`; 
    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Upload failed");
    return data.secure_url;
  };

  const filtered = useMemo(() => {
    console.log("🔎 useMemo filtered triggered:", {
      totalAssignments: assignments.length,
      currentFilter: filter,
      searchQuery: search
    });
    
    const base = assignments.filter((a) =>
      a.title.toLowerCase().includes(search.toLowerCase())
    );
    
    console.log(`  After search filter: ${base.length} assignments`);
    
    const result = base.filter((a) => a._status === filter);
    
    console.log(`  After status filter (${filter}): ${result.length} assignments`, result);
    
    return result;
  }, [assignments, filter, search]);

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.find((a) => a.id === selectedId) || filtered[0];
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId("");
      return;
    }
    if (selectedId && filtered.some((x) => x.id === selectedId)) return;
    setSelectedId(filtered[0]?.id || "");
  }, [filter, search, filtered.length, selectedId]);

  const handleOpenEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditData({
      title: assignment.title,
      description: assignment._description,
      deadline: assignment._deadlineAt
        ? assignment._deadlineAt.toISOString().slice(0, 16)
        : "",
    });
    setQuestionFile(null);
    setRubricFile(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAssignment) return;

    setSaving(true);
    setUploading(true);
    
    try {
      let questionUrl = editingAssignment._questionFileUrl;
      let rubricUrl = editingAssignment._rubricFileUrl;

      // Upload new files if selected
      if (questionFile) {
        questionUrl = await uploadFile(questionFile);
      }

      if (rubricFile) {
        rubricUrl = await uploadFile(rubricFile);
      }

      const chapterRef = doc(
        db,
        "classes",
        editingAssignment._classId,
        "chapters",
        editingAssignment._chapterId
      );
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        alert("Chapter not found");
        return;
      }

      const chapterData = chapterSnap.data() as ChapterDoc;
      const subchapters = chapterData?.subchapters || [];

      if (!subchapters[editingAssignment._subchapterIndex]) {
        alert("Subchapter not found");
        return;
      }

      const assignments =
        subchapters[editingAssignment._subchapterIndex]?.assignments || [];

      if (!assignments[editingAssignment._assignmentIndex]) {
        alert("Assignment not found");
        return;
      }

      // Update assignment
      assignments[editingAssignment._assignmentIndex] = {
        ...assignments[editingAssignment._assignmentIndex],
        title: editData.title,
        description: editData.description,
        deadline: editData.deadline ? Timestamp.fromDate(new Date(editData.deadline)) : null,
        questionFileUrl: questionUrl,
        rubricFileUrl: rubricUrl,
      };

      subchapters[editingAssignment._subchapterIndex].assignments = assignments;

      await updateDoc(chapterRef, { subchapters });

      // Update local state
      setAssignments((prev) =>
        prev.map((a) => {
          if (a.id !== editingAssignment.id) return a;
          const newDeadline = editData.deadline ? new Date(editData.deadline) : null;
          const isPastDeadline = newDeadline && newDeadline.getTime() <= Date.now();

          return {
            ...a,
            title: editData.title,
            instructions: editData.description,
            deadlineText: fmtDeadline(newDeadline),
            _description: editData.description,
            _deadlineAt: newDeadline,
            _questionFileUrl: questionUrl,
            _rubricFileUrl: rubricUrl,
            _status: isPastDeadline ? "Graded" : "On Going",
            attachments: [
              ...(questionUrl ? [{ name: "Soal.pdf", url: questionUrl }] : []),
              ...(rubricUrl ? [{ name: "Rubrik.pdf", url: rubricUrl }] : []),
            ],
          };
        })
      );

      setShowEditModal(false);
      setEditingAssignment(null);
      setQuestionFile(null);
      setRubricFile(null);
    } catch (error) {
      console.error("Error updating assignment:", error);
      alert("Failed to update assignment");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    if (!confirm(`Are you sure you want to delete "${assignment.title}"?`)) return;

    try {
      const chapterRef = doc(
        db,
        "classes",
        assignment._classId,
        "chapters",
        assignment._chapterId
      );
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        alert("Chapter not found");
        return;
      }

      const chapterData = chapterSnap.data() as ChapterDoc;
      const subchapters = chapterData?.subchapters || [];

      if (!subchapters[assignment._subchapterIndex]) {
        alert("Subchapter not found");
        return;
      }

      const assignments = subchapters[assignment._subchapterIndex]?.assignments || [];

      // Remove assignment from array
      assignments.splice(assignment._assignmentIndex, 1);
      subchapters[assignment._subchapterIndex].assignments = assignments;

      await updateDoc(chapterRef, { subchapters });

      // Update local state
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      setSelectedId("");
    } catch (error) {
      console.error("Error deleting assignment:", error);
      alert("Failed to delete assignment");
    }
  };

  const COLOR = {
    pageBg: "bg-[#F8F9FC]",
    shadowSoft: "shadow-[0_18px_40px_rgba(0,0,0,0.08)]",
    heroGrad: "bg-gradient-to-r from-[#B8B6FF] to-[#3D5AFE]",
    olive: { active: "bg-[#80711A]", idle: "bg-[#B7A21F]" },
    activeRow: "bg-[#4B67F6]",
    hoverRow: "hover:bg-[#EEF0F6]",
  };

  const PANEL_H = "h-[520px]";

  return (
    <div className={cn("min-h-screen", COLOR.pageBg)}>
      <main className="mx-20 pt-10 pb-16">
        {/* HERO + SEARCH */}
        <div className="flex items-center justify-between gap-10">
          <h1
            className={cn(
              "text-[54px] font-extrabold leading-none tracking-[-0.02em]",
              "text-transparent bg-clip-text",
              COLOR.heroGrad
            )}
          >
            Let&rsquo;s Back On Track!
          </h1>

          <div className="flex items-center gap-5">
            <div
              className={cn(
                "relative w-[460px] h-[44px] rounded-full bg-white",
                COLOR.shadowSoft
              )}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Material"
                className="h-full w-full rounded-full px-6 pr-12 text-[13px] outline-none border-none bg-transparent text-black placeholder:text-[#9CA3AF]"
              />
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6B7280]" />
            </div>

            <button
              type="button"
              aria-label="notifications"
              className={cn(
                "w-[44px] h-[44px] rounded-full bg-white flex items-center justify-center",
                COLOR.shadowSoft
              )}
            >
              <Bell className="w-[20px] h-[20px] text-[#3D5AFE]" />
            </button>
          </div>
        </div>

        {/* TITLE + FILTER */}
        <div className="mt-12 flex items-center justify-between">
          <h2 className="text-[30px] font-extrabold text-black">My Assignments</h2>

          <div className="flex items-center gap-3">
            {(["On Going", "Graded"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "h-[30px] px-5 rounded-full text-[12px] font-extrabold text-white transition",
                  filter === s
                    ? cn(COLOR.olive.active, "shadow-[0_10px_22px_rgba(128,113,26,0.35)]")
                    : cn(COLOR.olive.idle, "hover:brightness-95")
                )}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ASSIGNMENTS GRID */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 items-start">
          {/* LEFT LIST */}
          <div className={cn("bg-white overflow-hidden", COLOR.shadowSoft, PANEL_H)}>
            <div className="h-full overflow-auto">
              {loading ? (
                <div className="p-5 text-[12px] text-[#6B7280] font-medium">Loading...</div>
              ) : filtered.length ? (
                filtered.map((a, idx) => {
                  const active = a.id === selected?.id;
                  const isLast = idx === filtered.length - 1;

                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      type="button"
                      className={cn(
                        "w-full text-left px-5 py-4 transition-colors",
                        active ? COLOR.activeRow : "bg-white",
                        !active && COLOR.hoverRow,
                        !isLast && "border-b border-[#E6E7EA]"
                      )}
                    >
                      <div className="mb-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-[8px] text-[10px] font-extrabold",
                            active
                              ? "bg-[#DDE6FF] text-[#3D5AFE]"
                              : "bg-[#3D5AFE] text-white"
                          )}
                        >
                          {a.tag}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "text-[14px] font-extrabold leading-snug",
                          active ? "text-white" : "text-[#2F2F2F]"
                        )}
                      >
                        {a.title}
                      </div>

                      <div
                        className={cn(
                          "mt-1 text-[10px] font-medium",
                          active ? "text-[#E8ECFF]" : "text-[#9CA3AF]"
                        )}
                      >
                        {a.publishedAt}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-5 text-[12px] text-[#6B7280] font-medium">
                  Tidak ada tugas.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT DETAIL */}
          <div className={cn("bg-white", COLOR.shadowSoft, PANEL_H, "flex flex-col")}>
            {!selected ? (
              <div className="p-10 text-[12px] text-[#6B7280] font-medium" />
            ) : (
              <>
                <div className="px-10 pt-10">
                  <div className="mb-6">
                    <h3 className="text-[18px] md:text-[20px] font-extrabold text-black">
                      {selected.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-[#6B7280] font-medium">
                      {selected.deadlineText}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto px-10 pb-6 pr-8">
                  <div className="text-[12px] text-[#2F2F2F] leading-relaxed whitespace-pre-line">
                    {selected.instructions}
                  </div>

                  <div className="mt-6 space-y-2">
                    {selected.attachments.map((f, idx) => (
                      <a
                        key={idx}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 text-[12px] text-black font-medium hover:underline w-fit"
                      >
                        <FileText className="w-[16px] h-[16px] text-black" />
                        {f.name}
                      </a>
                    ))}
                  </div>

                  <div className="mt-10 border-t border-[#D1D5DB]" />

                  <div className="mt-6">
                    <div className="w-full border border-[#D1D5DB]">
                      <div className="grid grid-cols-[170px_1fr]">
                        <div className="border-b border-[#D1D5DB] px-4 py-3 text-[12px] font-extrabold text-black">
                          Submission Status
                        </div>
                        <div className="border-b border-[#D1D5DB] px-4 py-3 text-[12px] font-medium text-black">
                          {selected._status === "On Going" ? "No Attempt" : "Graded"}
                        </div>

                        <div className="px-4 py-3 text-[12px] font-extrabold text-black">
                          Time Remaining
                        </div>
                        <div className="px-4 py-3 text-[12px] font-medium text-black">
                          {selected._status === "Graded"
                            ? "Deadline Passed"
                            : selected._deadlineAt
                            ? (() => {
                                const ms =
                                  selected._deadlineAt.getTime() - Date.now();
                                const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                                const hours = Math.floor(
                                  (ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                                );
                                const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                                return `${days} days ${hours} hours ${mins} mins`;
                              })()
                            : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="px-10 pb-10 pt-2">
                  <div className="flex justify-center gap-3">
                    {selected._status === "On Going" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(selected)}
                          className={cn(
                            "h-[34px] rounded-[8px] px-5 text-[12px] font-bold text-white inline-flex items-center gap-2",
                            "bg-[#3D5AFE] hover:bg-[#2F49E8]",
                            "shadow-[0_14px_30px_rgba(61,90,254,0.25)]"
                          )}
                        >
                          <Pencil className="w-[14px] h-[14px]" />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(selected)}
                          className={cn(
                            "h-[34px] rounded-[8px] px-5 text-[12px] font-bold text-white inline-flex items-center gap-2",
                            "bg-[#6B7280] hover:bg-[#4B5563]",
                            "shadow-[0_14px_30px_rgba(107,114,128,0.25)]"
                          )}
                        >
                          <Trash2 className="w-[14px] h-[14px]" />
                          Delete Task
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/manage-class/${selected._classId}/activity/my-assignments/${selected._assignmentId}/reviews`)
                        }
                        className={cn(
                          "h-[34px] rounded-[8px] px-5 text-[12px] font-bold text-white inline-flex items-center gap-2",
                          "bg-[#3D5AFE] hover:bg-[#2F49E8]",
                          "shadow-[0_14px_30px_rgba(61,90,254,0.25)]"
                        )}
                      >
                        See Review
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* EDIT MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={editData.deadline}
                onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="questionFile">Question File (Soal)</Label>
              <Input
                id="questionFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
              />
              {editingAssignment?._questionFileUrl && !questionFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Current file: <a href={editingAssignment._questionFileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="rubricFile">Rubric File (Rubrik)</Label>
              <Input
                id="rubricFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setRubricFile(e.target.files?.[0] || null)}
              />
              {editingAssignment?._rubricFileUrl && !rubricFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Current file: <a href={editingAssignment._rubricFileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setQuestionFile(null);
                setRubricFile(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || uploading}>
              {uploading ? "Uploading..." : saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}