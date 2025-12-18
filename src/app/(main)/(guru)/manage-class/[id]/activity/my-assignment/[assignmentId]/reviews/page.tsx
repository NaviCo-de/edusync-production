// app/(main)/(guru)/manage-class/[id]/activity/my-assignments/[assignmentId]/reviews/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Search, Bell, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SubmissionData = {
  id: string;
  studentId: string;
  studentName: string;
  studentNIM: string;
  studentPhoto: string;
  score: number;
  files: Array<{ name: string; url: string }>;
  feedback: string;
  submittedAt: Date | null;
};

type AssignmentDetail = {
  title: string;
  description: string;
  deadline: Date | null;
  questionFileUrl: string;
  rubricFileUrl: string;
};

const COLOR = {
  pageBg: "#F8F9FC",
  shadowSoft: "shadow-[0_18px_40px_rgba(0,0,0,0.08)]",
  heroGrad: "bg-gradient-to-r from-[#B8B6FF] to-[#3D5AFE]",
  scoreBoxBg: "#EEF1FF",
  scoreBlue: "#4E6AF6",
};

function ScoreBox({ score }: { score: number }) {
  return (
    <div
      className={cn(
        "w-[92px] h-[92px] rounded-2xl shrink-0",
        "flex flex-col items-center justify-center",
        "shadow-[0_14px_34px_rgba(0,0,0,0.06)]"
      )}
      style={{ backgroundColor: COLOR.scoreBoxBg }}
    >
      <div
        className="text-[42px] font-extrabold leading-none"
        style={{ color: COLOR.scoreBlue }}
      >
        {score}
      </div>
      <div
        className="mt-1 text-[11px] font-extrabold"
        style={{ color: "rgba(78,106,246,0.72)" }}
      >
        Score
      </div>
    </div>
  );
}

function parseFeedback(feedbackText: string) {
  const defaultFeedback = {
    analysisTitle: "Analisis Prosedural",
    analysisBullets: [feedbackText || "Tidak ada feedback tersedia."],
    mistakesTitle: "Kesalahan Umum yang Terdeteksi",
    mistakesBullets: ["Tidak ada kesalahan yang terdeteksi."],
    fixTitle: "Rekomendasi Perbaikan",
    fixBullets: ["Pertahankan performa yang baik."],
  };

  if (!feedbackText) return defaultFeedback;

  try {
    const sections = feedbackText.split("\n\n");
    const result: any = { ...defaultFeedback };

    sections.forEach((section) => {
      const lines = section.split("\n").filter((l) => l.trim());
      if (lines.length > 0) {
        const title = lines[0];
        const bullets = lines
          .slice(1)
          .map((l) => l.replace(/^[•\-\*]\s*/, "").trim());

        if (title.toLowerCase().includes("analisis")) {
          result.analysisTitle = title;
          result.analysisBullets = bullets;
        } else if (title.toLowerCase().includes("kesalahan")) {
          result.mistakesTitle = title;
          result.mistakesBullets = bullets;
        } else if (
          title.toLowerCase().includes("rekomendasi") ||
          title.toLowerCase().includes("perbaikan")
        ) {
          result.fixTitle = title;
          result.fixBullets = bullets;
        }
      }
    });

    return result;
  } catch {
    return defaultFeedback;
  }
}

export default function AssignmentReviewsPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Find assignment details from all classes
      const assignmentData = await findAssignmentById(assignmentId);
      setAssignmentDetail(assignmentData);

      // 2. Fetch all submissions for this assignment
      const submissionsRef = collection(db, "submissions");
      const q = query(submissionsRef, where("assignmentId", "==", assignmentId));
      const submissionsSnap = await getDocs(q);

      const submissionsData: SubmissionData[] = [];

      for (const subDoc of submissionsSnap.docs) {
        const subData = subDoc.data();
        const gradedInfo = subData.graded_info;

        // Get student info
        const studentRef = doc(db, "users", subData.studentId);
        const studentSnap = await getDoc(studentRef);
        const studentData = studentSnap.exists() ? studentSnap.data() : null;

        submissionsData.push({
          id: subDoc.id,
          studentId: subData.studentId,
          studentName: subData.studentName || studentData?.nama || "Unknown",
          studentNIM: studentData?.uid?.slice(0, 12) || "N/A",
          studentPhoto: studentData?.photoURL || "/default-avatar.png",
          score: gradedInfo?.score || 0,
          files: subData.fileUrl
            ? [{ name: subData.fileName || "Submission.pdf", url: subData.fileUrl }]
            : [],
          feedback: gradedInfo?.feedback || "",
          submittedAt: subData.submittedAt?.toDate() || null,
        });
      }

      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const findAssignmentById = async (asgId: string): Promise<AssignmentDetail | null> => {
    try {
      // Get all classes
      const classesSnap = await getDocs(collection(db, "classes"));

      for (const classDoc of classesSnap.docs) {
        const chaptersRef = collection(db, "classes", classDoc.id, "chapters");
        const chaptersSnap = await getDocs(chaptersRef);

        for (const chapterDoc of chaptersSnap.docs) {
          const chapterData = chapterDoc.data();
          const subchapters = chapterData?.subchapters || [];

          for (const subchapter of subchapters) {
            const assignments = subchapter?.assignments || [];
            const found = assignments.find((a: any) => a.id === asgId);

            if (found) {
              // Safe date conversion
              const toDateSafe = (v: any): Date | null => {
                if (!v) return null;
                if (v instanceof Date) return v;
                if (typeof v?.toDate === "function") return v.toDate();
                if (typeof v === "string") {
                  const d = new Date(v);
                  return Number.isNaN(d.getTime()) ? null : d;
                }
                return null;
              };

              return {
                title: found.title || "Untitled Assignment",
                description: found.description || "-",
                deadline: toDateSafe(found.deadline),
                questionFileUrl: found.questionFileUrl || "",
                rubricFileUrl: found.rubricFileUrl || "",
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding assignment:", error);
      return null;
    }
  };

  const averageScore = submissions.length
    ? (submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length).toFixed(1)
    : "0";

  const filteredSubmissions = submissions.filter((s) =>
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLOR.pageBg }}
      >
        <p className="text-xl font-bold">Loading...</p>
      </div>
    );
  }

  if (!assignmentDetail) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLOR.pageBg }}
      >
        <p className="text-xl font-bold">Assignment not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLOR.pageBg }}>
      <div className="mx-20 pt-10 pb-16">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[32px] font-extrabold text-black">
            Review From {assignmentDetail.title}
          </h1>

          <div className="flex items-center gap-5">
            <div
              className={cn(
                "relative w-[460px] h-[44px] rounded-full bg-white",
                COLOR.shadowSoft
              )}
            >
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Siswa"
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

        {/* DETAIL TUGAS */}
        <div className={cn("bg-white rounded-2xl p-8 mb-8", COLOR.shadowSoft)}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-[24px] font-extrabold text-black mb-2">
                Detail Tugas
              </h2>
              <p className="text-[14px] text-[#6B7280] mb-4">
                Deadline on{" "}
                {assignmentDetail.deadline
                  ? assignmentDetail.deadline.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </p>
            </div>

            <button
              onClick={() =>
                setExpandedDetailId(expandedDetailId ? null : "detail")
              }
              className="text-gray-600 hover:text-gray-900"
            >
              {expandedDetailId ? (
                <ChevronUp className="w-7 h-7" />
              ) : (
                <ChevronDown className="w-7 h-7" />
              )}
            </button>
          </div>

          {expandedDetailId && (
            <div className="mt-4">
              <p className="text-[14px] text-black leading-relaxed whitespace-pre-line mb-4">
                {assignmentDetail.description}
              </p>

              <div className="space-y-2">
                {assignmentDetail.questionFileUrl && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 rounded-sm hover:bg-[#E7E7E7] transition-colors border">
                    <div className="flex items-center gap-3">
                      <img src="/pdf.png" alt="pdf" className="w-7 h-8" />
                      <span className="text-[14px] font-medium">
                        Pembagian Kelompok.pdf
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        handleDownload(
                          assignmentDetail.questionFileUrl,
                          "Soal.pdf"
                        )
                      }
                    >
                      <Download className="w-6 h-6 text-black" />
                    </button>
                  </div>
                )}

                {assignmentDetail.rubricFileUrl && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 rounded-sm hover:bg-[#E7E7E7] transition-colors border">
                    <div className="flex items-center gap-3">
                      <img src="/pdf.png" alt="pdf" className="w-7 h-8" />
                      <span className="text-[14px] font-medium">
                        Soal TK2 Kalkulus Sem Gasal.pdf
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        handleDownload(
                          assignmentDetail.rubricFileUrl,
                          "Rubrik.pdf"
                        )
                      }
                    >
                      <Download className="w-6 h-6 text-black" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STATISTICS */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-[16px]">
            <span className="font-semibold text-[#3D5AFE]">Total Submission</span>{" "}
            <span className="font-extrabold text-[#3D5AFE]">
              {submissions.length} Students
            </span>
          </div>

          <div className="text-[16px]">
            <span className="font-semibold text-[#3D5AFE]">Rata-rata Nilai</span>{" "}
            <span className="font-extrabold text-[#3D5AFE]">
              {averageScore}/100
            </span>
          </div>
        </div>

        {/* SUBMISSIONS LIST */}
        <div className="space-y-6">
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className={cn("bg-white rounded-2xl p-8", COLOR.shadowSoft)}
            >
              {/* COLLAPSED VIEW */}
              {expandedDetailId !== submission.id ? (
                <div className="flex items-center justify-between gap-6">
                  {/* LEFT: Profile */}
                  <div className="flex items-center gap-4">
                    <img
                      src={submission.studentPhoto}
                      alt={submission.studentName}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-[18px] font-extrabold text-[#B08A00]">
                        {submission.studentName}
                      </h3>
                      <p className="text-[12px] text-[#6B7280]">
                        {submission.studentNIM}
                      </p>
                    </div>
                  </div>

                  {/* CENTER: Buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => router.push(`/profile/${submission.studentId}`)}
                      className="bg-[#FFE16A] hover:bg-[#FFD54F] text-[#5A4F14] text-[14px] font-bold px-6 py-3 h-auto"
                    >
                      Visit Profile
                    </Button>
                    <Button
                      onClick={() => setExpandedDetailId(submission.id)}
                      className="bg-[#3D5AFE] hover:bg-[#2F49E8] text-white text-[14px] font-bold px-6 py-3 h-auto"
                    >
                      See Feedback
                    </Button>
                  </div>

                  {/* RIGHT: Score */}
                  <ScoreBox score={submission.score} />
                </div>
              ) : (
                /* EXPANDED VIEW */
                <>
                  <div className="flex items-center justify-between gap-6 mb-6">
                    {/* LEFT: Profile + Visit Profile Button */}
                    <div className="flex items-center gap-4">
                      <img
                        src={submission.studentPhoto}
                        alt={submission.studentName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="text-[18px] font-extrabold text-[#B08A00]">
                          {submission.studentName}
                        </h3>
                        <p className="text-[12px] text-[#6B7280]">
                          {submission.studentNIM}
                        </p>
                      </div>
                      <Button
                        onClick={() => router.push(`/profile/${submission.studentId}`)}
                        className="bg-[#FFE16A] hover:bg-[#FFD54F] text-[#5A4F14] text-[14px] font-bold px-6 py-3 h-auto ml-4"
                      >
                        Visit Profile
                      </Button>
                    </div>

                    {/* RIGHT: Score */}
                    <ScoreBox score={submission.score} />
                  </div>

                  {/* FEEDBACK SECTION */}
                  <div className="mb-6">
                    <div className="text-[16px] font-extrabold text-black mb-4">
                      Feedback By <span style={{ color: COLOR.scoreBlue }}>Lynx</span>
                    </div>

                    {(() => {
                      const feedback = parseFeedback(submission.feedback);
                      return (
                        <>
                          <div className="space-y-2 mb-4">
                            <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
                              ✍️ <span>{feedback.analysisTitle}</span>
                            </div>
                            <ul className="space-y-2 text-[13px] text-black">
                              {feedback.analysisBullets.map((b: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined, i: React.Key | null | undefined) => (
                                <li key={i} className="flex gap-3">
                                  <span className="mt-[2px]">•</span>
                                  <span className="leading-relaxed">{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
                              ⚠️ <span>{feedback.mistakesTitle}</span>
                            </div>
                            <ul className="space-y-2 text-[13px] text-black">
                              {feedback.mistakesBullets.map((b: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined, i: React.Key | null | undefined) => (
                                <li key={i} className="flex gap-3">
                                  <span className="mt-[2px]">❌</span>
                                  <span className="leading-relaxed">{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-2">
                            <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
                              💡 <span>{feedback.fixTitle}</span>
                            </div>
                            <ul className="space-y-2 text-[13px] text-black">
                              {feedback.fixBullets.map((b: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined, i: React.Key | null | undefined) => (
                                <li key={i} className="flex gap-3">
                                  <span className="mt-[2px]">•</span>
                                  <span className="leading-relaxed">{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* SUBMISSION FILES */}
                  <div className="mb-6">
                    <h4 className="text-[14px] font-extrabold text-black mb-3">
                      Submission
                    </h4>
                    <div className="space-y-2">
                      {submission.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white px-4 py-3 rounded-sm hover:bg-[#E7E7E7] transition-colors border"
                        >
                          <div className="flex items-center gap-3">
                            <img src="/pdf.png" alt="pdf" className="w-7 h-8" />
                            <span className="text-[14px] font-medium">
                              {file.name}
                            </span>
                          </div>
                          <button onClick={() => handleDownload(file.url, file.name)}>
                            <Download className="w-6 h-6 text-black" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CLOSE FEEDBACK BUTTON */}
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setExpandedDetailId(null)}
                      className="bg-[#6B7280] hover:bg-[#4B5563] text-white text-[14px] font-bold px-6 py-3 h-auto"
                    >
                      Close Feedback
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {filteredSubmissions.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[#6B7280] text-[16px]">
                Belum ada submission untuk tugas ini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}