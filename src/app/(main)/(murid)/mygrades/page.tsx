// src/app/(main)/(murid)/my-grades/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, Bell, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// =====================
// TYPES
// =====================
type SubjectTab = string;

type GradeCardData = {
  id: string;
  subject: SubjectTab;
  score: number;
  title: string;
  deadlineText: string;
  expanded: boolean;
  feedback: {
    analysisTitle: string;
    analysisBullets: string[];
    mistakesTitle: string;
    mistakesBullets: string[];
    fixTitle: string;
    fixBullets: string[];
  };
  table: {
    gradingStatus: string;
    finishedOn: string;
  };
};

// =====================
// TOKENS
// =====================
const TOK = {
  pageBg: "#F8F9FC",
  tabBlue: "#4E6AF6",
  tabPurple: "#7649F6",
  tabMustard: "#A7973B",
  textGrey: "#6B7280",
  iconGrey: "#9CA3AF",
  border: "#E7E7E7",
  tableBorder: "rgba(156,163,175,0.70)",
  cardBg: "#FFFFFF",
  scoreBoxBg: "#EEF1FF",
  scoreBlue: "#4E6AF6",
};

const HERO_GRADIENT = "linear-gradient(90deg, #EEF1FF 0%, #C9D1FF 55%, #B6B4FF 100%)";
const CANVAS_W = "";
const PILL_SHADOW = "shadow-[0_14px_34px_rgba(0,0,0,0.10)]";
const CARD_SHADOW = "shadow-[0_18px_44px_rgba(0,0,0,0.08)]";

// Color mapping for class chips (loops every 3 classes)
const CLASS_COLORS = [TOK.tabBlue, TOK.tabPurple, TOK.tabMustard];

function TabButton({
  label,
  active,
  onClick,
  colorIndex,
}: {
  label: SubjectTab;
  active: boolean;
  onClick: () => void;
  colorIndex: number;
}) {
  const color = CLASS_COLORS[colorIndex % 3];
  const isMustard = colorIndex % 3 === 2;

  if (isMustard) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "h-[44px] px-7 rounded-[14px] text-[14px] font-extrabold",
          "bg-white border transition hover:bg-[#FAFAFA]",
          PILL_SHADOW,
          active && "ring-2 ring-black/5"
        )}
        style={{ color: TOK.tabMustard, borderColor: TOK.border }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-[44px] px-7 rounded-[14px] text-[14px] font-extrabold text-white",
        "transition hover:brightness-95",
        PILL_SHADOW,
        active && "ring-2 ring-black/5"
      )}
      style={{ backgroundColor: color }}
    >
      {label}
    </button>
  );
}

function ScoreBox({ score }: { score: number }) {
  return (
    <div
      className={cn(
        "w-[92px] h-[92px] rounded-2xl shrink-0",
        "flex flex-col items-center justify-center",
        "shadow-[0_14px_34px_rgba(0,0,0,0.06)]"
      )}
      style={{ backgroundColor: TOK.scoreBoxBg }}
    >
      <div className="text-[42px] font-extrabold leading-none" style={{ color: TOK.scoreBlue }}>
        {score}
      </div>
      <div className="mt-1 text-[11px] font-extrabold" style={{ color: "rgba(78,106,246,0.72)" }}>
        Score
      </div>
    </div>
  );
}

function FeedbackByLynx({ feedback }: { feedback: GradeCardData["feedback"] }) {
  return (
    <div className="mt-6">
      <div className="text-[16px] font-extrabold text-black mb-4">
        Feedback By <span style={{ color: TOK.scoreBlue }}>Lynx</span>
      </div>

      <div className="space-y-2">
        <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
          ✍️ <span>{feedback.analysisTitle}</span>
        </div>
        <ul className="space-y-2 text-[13px] text-black">
          {feedback.analysisBullets.map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[2px]">•</span>
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-2">
        <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
          ⚠️ <span>{feedback.mistakesTitle}</span>
        </div>
        <ul className="space-y-2 text-[13px] text-black">
          {feedback.mistakesBullets.map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[2px]">❌</span>
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-2">
        <div className="font-extrabold text-[14px] text-black flex items-center gap-2">
          💡 <span>{feedback.fixTitle}</span>
        </div>
        <ul className="space-y-2 text-[13px] text-black">
          {feedback.fixBullets.map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[2px]">•</span>
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GradeCard({ item, onToggle }: { item: GradeCardData; onToggle: (id: string) => void }) {
  return (
    <div className={cn("rounded-2xl", CARD_SHADOW)} style={{ backgroundColor: TOK.cardBg }}>
      <div className="px-10 py-9">
        <div className="flex items-start gap-8">
          <ScoreBox score={item.score} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[20px] font-extrabold text-black leading-tight">{item.title}</div>
                <div className="mt-2 text-[12px] font-medium flex items-center gap-2" style={{ color: TOK.textGrey }}>
                  <Clock className="w-4 h-4" style={{ color: TOK.iconGrey }} />
                  <span>{item.deadlineText}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="pt-1 text-gray-600 hover:text-gray-900"
                aria-label="toggle"
              >
                {item.expanded ? <ChevronUp className="w-7 h-7" /> : <ChevronDown className="w-7 h-7" />}
              </button>
            </div>

            {item.expanded ? (
              <>
                <FeedbackByLynx feedback={item.feedback} />

                <div className="mt-8 border-t" style={{ borderColor: TOK.tableBorder }} />

                <div className="mt-6">
                  <div className="w-full border" style={{ borderColor: TOK.tableBorder }}>
                    <div className="grid grid-cols-[220px_1fr]">
                      <div
                        className="border-b px-5 py-3 text-[13px] font-extrabold text-black"
                        style={{ borderColor: TOK.tableBorder }}
                      >
                        Grading Status
                      </div>
                      <div
                        className="border-b px-5 py-3 text-[13px] font-medium text-black"
                        style={{ borderColor: TOK.tableBorder }}
                      >
                        {item.table.gradingStatus}
                      </div>

                      <div className="px-5 py-3 text-[13px] font-extrabold text-black">Finished On</div>
                      <div className="px-5 py-3 text-[13px] font-medium text-black">{item.table.finishedOn}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyGradesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userClasses, setUserClasses] = useState<Array<{id: string, name: string}>>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cards, setCards] = useState<GradeCardData[]>([]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadUserClasses(user.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user's enrolled classes
  const loadUserClasses = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const classIds = userData.daftarKelas || [];
        
        const classesData = await Promise.all(
          classIds.map(async (classId: string) => {
            const classRef = doc(db, "classes", classId);
            const classSnap = await getDoc(classRef);
            return classSnap.exists() 
              ? { id: classId, name: classSnap.data().name || "Unknown Class" }
              : null;
          })
        );
        
        const validClasses = classesData.filter(c => c !== null) as Array<{id: string, name: string}>;
        setUserClasses(validClasses);
        if (validClasses.length > 0) {
          setActiveTab(validClasses[0].name);
          await loadGradedAssignments(userId, validClasses[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading user classes:", error);
    }
  };

  // Auto-submit and grade overdue assignments
  const autoSubmitOverdueAssignments = async (userId: string, classId: string) => {
    try {
      const now = Timestamp.now();
      
      // Get all chapters in this class
      const chaptersRef = collection(db, "classes", classId, "chapters");
      const chaptersSnap = await getDocs(chaptersRef);
      
      const batch = writeBatch(db);
      const assignmentsToGrade: any[] = [];

      for (const chapterDoc of chaptersSnap.docs) {
        const chapterData = chapterDoc.data();
        const subchapters = chapterData.subchapters || [];
        
        for (const subchapter of subchapters) {
          const assignments = subchapter.assignments || [];
          
          for (const assignment of assignments) {
            // Check if deadline exists and has passed
            const hasDeadline = assignment.deadline && assignment.deadline.toDate;
            const isPastDeadline = hasDeadline && assignment.deadline.toDate() < now.toDate();
            
            if (isPastDeadline) {
              // Check if submission exists
              const submissionsRef = collection(db, "submissions");
              const q = query(
                submissionsRef,
                where("assignmentId", "==", assignment.id),
                where("studentId", "==", userId)
              );
              const submissionSnap = await getDocs(q);
              
              if (submissionSnap.empty) {
                // Create late submission
                const newSubmissionRef = doc(collection(db, "submissions"));
                batch.set(newSubmissionRef, {
                  assignmentId: assignment.id,
                  studentId: userId,
                  studentName: currentUser?.displayName || "Unknown",
                  status: "LATE_SUBMITTED",
                  submittedAt: now,
                  fileName: "",
                  fileUrl: "",
                });
                
                assignmentsToGrade.push({
                  submissionId: newSubmissionRef.id,
                  assignment,
                  answer: "",
                  fileUrl: "",
                });
              } else {
                // Check existing submissions that need grading
                submissionSnap.forEach(subDoc => {
                  const subData = subDoc.data();
                  if (subData.status === "SUBMITTED" || subData.status === "LATE_SUBMITTED") {
                    assignmentsToGrade.push({
                      submissionId: subDoc.id,
                      assignment,
                      answer: subData.answer || "",
                      fileUrl: subData.fileUrl || "",
                    });
                  }
                });
              }
            }
          }
        }
      }
      
      await batch.commit();
      
      // Grade all pending assignments
      for (const item of assignmentsToGrade) {
        await gradeAssignment(item.submissionId, item.assignment, item.answer, item.fileUrl);
      }
    } catch (error) {
      console.error("Error auto-submitting overdue assignments:", error);
    }
  };

  // Grade assignment using AI
  const gradeAssignment = async (
    submissionId: string, 
    assignment: any, 
    answer: string, 
    fileUrl: string
  ) => {
    try {
      const requestBody: any = {
        assignment_id: assignment.id,
        type: assignment.type,
        rubric: assignment.rubricFileUrl || "",
        submissions: [{
          student_id: currentUser?.uid,
          answer: answer,
          file_url: fileUrl,
        }]
      };

      if (assignment.questionFileUrl) {
        if (assignment.questionFileUrl.endsWith('.pdf')) {
          requestBody.question_pdf_url = assignment.questionFileUrl;
        } else {
          requestBody.question_image_url = assignment.questionFileUrl;
        }
      }

      const response = await fetch("https://lynx-ai.up.railway.app/grade/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Grading failed");
      }

      const result = await response.json();
      const gradeResult = result.batch_result?.details?.[0]?.result;
      
      if (gradeResult) {
        const parsedResult = typeof gradeResult === 'string' 
          ? JSON.parse(gradeResult) 
          : gradeResult;
        
        // Update submission with graded info
        const submissionRef = doc(db, "submissions", submissionId);
        await updateDoc(submissionRef, {
          status: "GRADED",
          graded_info: {
            score: parsedResult.score || 0,
            feedback: parsedResult.feedback || "",
            correct_count: parsedResult.correct_count || 0,
            graded_at: Timestamp.now(),
          }
        });
      }
    } catch (error) {
      console.error("Error grading assignment:", error);
    }
  };

  // Load graded assignments for active class
  const loadGradedAssignments = async (userId: string, classId: string) => {
    try {
      // First auto-submit overdue assignments
      await autoSubmitOverdueAssignments(userId, classId);
      
      // Then fetch all graded submissions
      const submissionsRef = collection(db, "submissions");
      const q = query(
        submissionsRef,
        where("studentId", "==", userId),
        where("status", "==", "GRADED")
      );
      
      const submissionsSnap = await getDocs(q);
      const gradeCards: GradeCardData[] = [];
      
      // Get class name
      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      const className = classSnap.exists() ? classSnap.data().name : "Unknown";

      for (const subDoc of submissionsSnap.docs) {
        const subData = subDoc.data();
        const gradedInfo = subData.graded_info;
        
        if (!gradedInfo) continue;

        // Find assignment details
        const assignmentDetails = await findAssignmentDetails(classId, subData.assignmentId);
        
        if (assignmentDetails) {
          const feedback = parseFeedback(gradedInfo.feedback);
          const deadlineDate = assignmentDetails.deadline?.toDate();
          const submittedDate = subData.submittedAt?.toDate();
          
          gradeCards.push({
            id: subDoc.id,
            subject: className,
            score: gradedInfo.score || 0,
            title: assignmentDetails.title || "Untitled Assignment",
            deadlineText: deadlineDate 
              ? `Deadline on ${formatDate(deadlineDate)}`
              : "No deadline",
            expanded: false,
            feedback,
            table: {
              gradingStatus: "Graded",
              finishedOn: submittedDate 
                ? formatDateTime(submittedDate)
                : "Unknown",
            }
          });
        }
      }
      
      setCards(gradeCards);
    } catch (error) {
      console.error("Error loading graded assignments:", error);
    }
  };

  // Find assignment details from class structure
  const findAssignmentDetails = async (classId: string, assignmentId: string) => {
    try {
      const chaptersRef = collection(db, "classes", classId, "chapters");
      const chaptersSnap = await getDocs(chaptersRef);
      
      for (const chapterDoc of chaptersSnap.docs) {
        const chapterData = chapterDoc.data();
        const subchapters = chapterData.subchapters || [];
        
        for (const subchapter of subchapters) {
          const assignments = subchapter.assignments || [];
          const found = assignments.find((a: any) => a.id === assignmentId);
          if (found) return found;
        }
      }
      return null;
    } catch (error) {
      console.error("Error finding assignment:", error);
      return null;
    }
  };

  // Parse AI feedback into structured format
  const parseFeedback = (feedbackText: string) => {
    // Default structure if parsing fails
    const defaultFeedback = {
      analysisTitle: "Analisis Prosedural",
      analysisBullets: [feedbackText || "Tidak ada feedback tersedia."],
      mistakesTitle: "Kesalahan Umum yang Terdeteksi",
      mistakesBullets: ["Tidak ada kesalahan yang terdeteksi."],
      fixTitle: "Rekomendasi Perbaikan",
      fixBullets: ["Pertahankan performa yang baik."],
    };

    if (!feedbackText) return defaultFeedback;

    // Try to parse structured feedback
    try {
      const sections = feedbackText.split('\n\n');
      const result: any = { ...defaultFeedback };
      
      sections.forEach(section => {
        const lines = section.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const title = lines[0];
          const bullets = lines.slice(1).map(l => l.replace(/^[•\-\*]\s*/, '').trim());
          
          if (title.toLowerCase().includes('analisis')) {
            result.analysisTitle = title;
            result.analysisBullets = bullets;
          } else if (title.toLowerCase().includes('kesalahan')) {
            result.mistakesTitle = title;
            result.mistakesBullets = bullets;
          } else if (title.toLowerCase().includes('rekomendasi') || title.toLowerCase().includes('perbaikan')) {
            result.fixTitle = title;
            result.fixBullets = bullets;
          }
        }
      });
      
      return result;
    } catch {
      return defaultFeedback;
    }
  };

  // Format date helper
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' - ' + date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Handle tab change
  const handleTabChange = async (className: string) => {
    setActiveTab(className);
    const selectedClass = userClasses.find(c => c.name === className);
    if (selectedClass && currentUser) {
      await loadGradedAssignments(currentUser.uid, selectedClass.id);
    }
  };

  // Filter cards
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards
      .filter((c) => c.subject === activeTab)
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  }, [cards, activeTab, searchQuery]);

  const toggleCard = (id: string) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)));
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: TOK.pageBg }}>
        <div className="text-xl font-bold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: TOK.pageBg }}>
      <div className={cn("mx-20 pb-24")}>
        {/* HERO */}
        <div className="pt-12">
          <div className="flex items-start justify-between gap-10">
            <h1
              className={cn("text-[48px] font-extrabold leading-none", "bg-clip-text text-transparent")}
              style={{
                backgroundImage: HERO_GRADIENT,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Let&rsquo;s See Your Progress Here!
            </h1>

            <div className="flex items-center gap-6 pt-2">
              <div className="relative w-[520px]">
                <Input
                  placeholder="Search Material"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "h-[50px] rounded-full bg-white border-0 ring-0 focus-visible:ring-0",
                    "pl-6 pr-12 text-[14px] font-medium",
                    PILL_SHADOW
                  )}
                />
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: TOK.textGrey }} />
              </div>

              <button
                type="button"
                className={cn("h-[50px] w-[50px] rounded-full bg-white flex items-center justify-center", PILL_SHADOW)}
                aria-label="notifications"
              >
                <Bell className="h-6 w-6" style={{ color: TOK.tabBlue }} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-12 flex items-center gap-6">
            {userClasses.map((cls, idx) => (
              <TabButton 
                key={cls.id} 
                label={cls.name} 
                active={activeTab === cls.name} 
                onClick={() => handleTabChange(cls.name)}
                colorIndex={idx}
              />
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="mt-14 px-12">
          {filteredCards.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              Belum ada tugas yang dinilai untuk kelas ini.
            </div>
          ) : (
            <div className="space-y-12">
              {filteredCards.map((item) => (
                <GradeCard key={item.id} item={item} onToggle={toggleCard} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}