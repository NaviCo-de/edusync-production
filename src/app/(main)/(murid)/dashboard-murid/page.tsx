"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isSameYear,
} from "date-fns";
import { id as indonesia } from "date-fns/locale";
import { Bell, ChevronLeft, ChevronRight, Search, ArrowRight, X, FileText } from "lucide-react";

// Firebase
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  orderBy,
  limit
} from "firebase/firestore";

// ---------- TYPES ----------
interface UserProfile {
  uid: string;
  displayName: string | null;
  grade_level: string;
  photoURL?: string | null;
}

interface StudentClass {
  id: string;
  name: string;
  subject: string;
  teacherName?: string;
  schedule?: string;
  studentCount?: number;
}

type AssignmentStatus = "ongoing" | "graded" | "submitted";

// Struktur Assignment sesuai Database (Nested)
interface Assignment {
  id: string;
  title: string;
  subject: string; // Diambil dari parent class
  classId: string;
  dueDate?: Timestamp | null;
  status: AssignmentStatus;
  score?: number | null;
  submittedAt?: Timestamp | null;
  author?: string | null;
  publishedAt?: Timestamp | null;
  description?: string; // Optional untuk detail
}

interface Submission {
  assignmentId: string;
  status: string; // "SUBMITTED" | "GRADED"
  score?: number;
  submittedAt: Timestamp;
  fileUrl?: string;
}

type AnnouncementAttachment = {
  name: string;
  url: string;
};

interface Announcement {
  id: string;
  title: string;
  author: string;
  createdAt?: Timestamp | null;
  excerpt: string;
  content?: string;
  attachments?: AnnouncementAttachment[];
  href?: string;
  classId?: string;
}

// Untuk Lynx (Biarkan sesuai original)
interface LynxRecommendation {
  subject: string;
  advice: string;
  resource_link: string;
}

interface LynxAnalysisResult {
  weaknesses: string[];
  recommendations: LynxRecommendation[];
}

// ---------- UI HELPERS ----------
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const CHIP_STYLES = [
  { bg: "bg-[#3D5AFE]", text: "text-white" },
  { bg: "bg-[#FFD54F]", text: "text-[#5D4037]" },
  { bg: "bg-[#6C63FF]", text: "text-white" },
];

function safeInitial(name?: string | null) {
  const s = (name || "").trim();
  return s.length ? s[0].toUpperCase() : "S";
}

function prettyPublished(ts?: Timestamp | null) {
  if (!ts) return "-";
  return format(ts.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia });
}

// ---------- MAIN ----------
export default function DashboardMuridPage() {
  const router = useRouter();

  // auth / profile
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // data loading
  const [loadingData, setLoadingData] = useState(true);
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]); // Semua assignment (flattened)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // lynx
  const [lynxData, setLynxData] = useState<LynxAnalysisResult | null>(null);
  const [loadingLynx, setLoadingLynx] = useState(false);
  const [errorLynx, setErrorLynx] = useState<string | null>(null);

  // calendar
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // ---------- ANNOUNCEMENT DRAWER STATE ----------
  const [isAnnDrawerOpen, setIsAnnDrawerOpen] = useState(false);
  const [activeAnnouncementId, setActiveAnnouncementId] = useState<string | null>(null);

  const closeAnnouncementDrawer = () => setIsAnnDrawerOpen(false);
  const openAnnouncementDrawer = (id: string) => {
    setActiveAnnouncementId(id);
    setIsAnnDrawerOpen(true);
  };

  useEffect(() => {
    if (!isAnnDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAnnouncementDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAnnDrawerOpen]);

  // ---------- 1. AUTH & USER PROFILE ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const userDocRef = collection(db, "users");
        // Asumsi struktur users: collection 'users', field 'uid' (seperti screenshot)
        // Sebaiknya gunakan doc(db, 'users', currentUser.uid) jika document ID == UID.
        // Tapi mengikuti screenshot Query:
        const q = query(userDocRef, where("uid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        let grade = "12 SMA";
        let photo = currentUser.photoURL;
        let displayName = currentUser.displayName || "Siswa";

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          if (data.grade_level) grade = data.grade_level;
          if (data.photoURL) photo = data.photoURL;
          if (data.nama) displayName = data.nama; // Sesuai screenshot 'nama'
        }

        setUserProfile({
          uid: currentUser.uid,
          displayName: displayName,
          grade_level: grade,
          photoURL: photo,
        });
      } catch (e) {
        console.error("Error fetch user:", e);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ---------- 2. DATA FETCHING (Classes, Assignments, Announcements) ----------
  useEffect(() => {
    if (!userProfile) return;

    const fetchAllData = async () => {
      setLoadingData(true);
      try {
        // A. Fetch Classes (dimana student terdaftar)
        // Perhatikan field 'students' array-contains uid
        const classesRef = collection(db, "classes");
        const qClasses = query(classesRef, where("students", "array-contains", userProfile.uid));
        const classSnapshot = await getDocs(qClasses);

        const fetchedClasses: StudentClass[] = classSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Kelas",
          subject: doc.data().subject || doc.data().name || "Umum",
          teacherName: doc.data().teacherName || "Guru",
          schedule: doc.data().schedule,
        }));
        setClasses(fetchedClasses);

        if (fetchedClasses.length === 0) {
          setLoadingData(false);
          return;
        }

        // B. Fetch Submissions (Siswa ini)
        // Untuk mengecek status assignment (submitted/graded)
        const subRef = collection(db, "submissions");
        const qSub = query(subRef, where("studentId", "==", userProfile.uid));
        const subSnapshot = await getDocs(qSub);
        
        const submissionsMap = new Map<string, Submission>();
        subSnapshot.forEach((doc) => {
          const d = doc.data();
          // Asumsi field assignmentId ada di submission
          if (d.assignmentId) {
            submissionsMap.set(d.assignmentId, {
              assignmentId: d.assignmentId,
              status: d.status, // "SUBMITTED" or "GRADED"
              score: d.score,
              submittedAt: d.submittedAt,
              fileUrl: d.fileUrl
            });
          }
        });

        // C. Parallel Fetch: Announcements & Assignments (Deep Nested)
        let tempAnnouncements: Announcement[] = [];
        let tempAssignments: Assignment[] = [];

        // Kita harus loop per kelas karena struktur nested
        await Promise.all(fetchedClasses.map(async (cls) => {
            // C.1 Fetch Announcements per Class
            // Announcement adalah subcollection dari class
            const annRef = collection(db, "classes", cls.id, "announcements");
            // Ambil yg terbaru (misal limit 5 per kelas lalu nanti di sort global)
            const qAnn = query(annRef, orderBy("createdAt", "desc"), limit(5));
            const annSnap = await getDocs(qAnn);
            
            annSnap.forEach(doc => {
                const d = doc.data();
                tempAnnouncements.push({
                    id: doc.id,
                    title: d.title || "Pengumuman",
                    author: d.author || cls.teacherName || "Guru",
                    createdAt: d.createdAt,
                    excerpt: d.excerpt || d.content?.substring(0, 100) || "",
                    content: d.content || "",
                    attachments: d.attachments || [],
                    href: "#",
                    classId: cls.id
                });
            });

            // C.2 Fetch Assignments (Deep Nested in Chapters -> Subchapters array)
            const chaptersRef = collection(db, "classes", cls.id, "chapters");
            const chaptersSnap = await getDocs(chaptersRef);

            chaptersSnap.forEach(chapDoc => {
                const chapData = chapDoc.data();
                const subchapters = chapData.subchapters || []; // Array of Objects

                // Loop subchapters array
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                subchapters.forEach((sub: any) => {
                    const assignmentsInSub = sub.assignments || []; // Array of Objects
                    
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    assignmentsInSub.forEach((asg: any) => {
                        // Cek status berdasarkan submission
                        const subData = submissionsMap.get(asg.id);
                        
                        let finalStatus: AssignmentStatus = "ongoing";
                        let finalScore = null;
                        let finalSubmittedAt = null;

                        if (subData) {
                            if (subData.status === "GRADED") {
                                finalStatus = "graded";
                                finalScore = subData.score;
                            } else {
                                finalStatus = "submitted";
                            }
                            finalSubmittedAt = subData.submittedAt;
                        }

                        tempAssignments.push({
                            id: asg.id,
                            title: asg.title,
                            subject: cls.subject, // Nama mapel dari parent class
                            classId: cls.id,
                            dueDate: asg.deadline ? Timestamp.fromDate(new Date(asg.deadline)) : asg.dueDate, // Handle format string/timestamp
                            status: finalStatus,
                            score: finalScore,
                            submittedAt: finalSubmittedAt,
                            publishedAt: asg.publishedAt,
                            author: cls.teacherName
                        });
                    });
                });
            });
        }));

        // D. Finalizing Data
        // Sort Announcement Global (Desc) & Limit 5
        tempAnnouncements.sort((a, b) => {
            const tA = a.createdAt?.toMillis() || 0;
            const tB = b.createdAt?.toMillis() || 0;
            return tB - tA;
        });
        setAnnouncements(tempAnnouncements.slice(0, 5));

        // Sort Assignments Global (by DueDate Ascending for ongoing, Desc for others)
        tempAssignments.sort((a, b) => {
            const tA = a.dueDate?.toMillis() || 0;
            const tB = b.dueDate?.toMillis() || 0;
            return tA - tB;
        });
        setAssignments(tempAssignments);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllData();
    fetchLynxAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  // ---------- LYNX AI FETCH ----------
  const fetchLynxAnalysis = async () => {
    if (!userProfile) return;
    setLoadingLynx(true);
    setErrorLynx(null);

    try {
      const response = await fetch("https://lynx-ai.up.railway.app/analysis/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: userProfile.uid,
          student_name: userProfile.displayName,
          grade_level: userProfile.grade_level,
        }),
      });

      if (!response.ok) throw new Error("Gagal terhubung ke AI");

      const data = await response.json();
      setLynxData(data);
    } catch {
        // Silent error or set null
      setLynxData(null);
    } finally {
      setLoadingLynx(false);
    }
  };

  // ---------- DATA PROCESSING FOR UI ----------

  // 1. Assignments Grouping
  const visualAssignments = useMemo(() => {
    const ongoing = assignments.filter((a) => a.status === "ongoing");
    const graded = assignments.filter((a) => a.status === "graded");
    const submitted = assignments.filter((a) => a.status === "submitted");

    return {
      ongoing: ongoing.slice(0, 3),
      graded: graded.slice(0, 3), // Limit tampilan
      submitted: submitted.slice(0, 3),
    };
  }, [assignments]);

  // 2. Calendar Logic
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [monthCursor]);

  // Cari tugas di tanggal yang dipilih (Selected Date Logic)
  const assignmentsOnSelectedDate = useMemo(() => {
      return assignments.filter(a => {
          if (!a.dueDate) return false;
          // Filter ongoing saja yang muncul di reminder, atau semua? 
          // Sesuai request: "ada tugas apa saja yang ongoing di deadline tersebut"
          if (a.status !== 'ongoing') return false; 
          return isSameDay(a.dueDate.toDate(), selectedDate);
      });
  }, [assignments, selectedDate]);

  const activeAnnouncement = useMemo(() => {
    if (!activeAnnouncementId) return null;
    return announcements.find((a) => a.id === activeAnnouncementId) || announcements[0] || null;
  }, [activeAnnouncementId, announcements]);

  // ---------- RENDER LOADING ----------
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3D5AFE] border-t-transparent" />
      </div>
    );
  }

  // ---------- RENDER MAIN ----------
  return (
    <div className="min-h-screen bg-[#F3F6FF]">
      <main className="mx-20 px-6 py-8">
        {/* Welcome + Search + Bell */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-[42px] leading-tight font-extrabold bg-linear-to-r from-blue-20 via-blue-40 to-blue-base bg-clip-text text-transparent w-fit">
              Welcome Again, {userProfile?.displayName || "Siswa"}!
            </h1>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="relative w-[340px] hidden sm:block">
              <input
                className="w-full h-11 rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)] px-5 pr-12 text-sm outline-none border border-transparent focus:border-[#3D5AFE]/30"
                placeholder="Search Material"
              />
              <Search className="h-5 w-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>

            <button
              type="button"
              className="h-11 w-11 rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-[#3D5AFE]" />
            </button>
          </div>
        </div>

        {/* Announcement + Calendar/Reminder row */}
        <div className="mt-8 flex justify-between items-end">
          <div className="flex flex-col">
            {/* Chips Classes */}
            <div className="mt-4 flex flex-wrap gap-3 mb-4">
              {classes.slice(0, 5).map((c, idx) => {
                const s = CHIP_STYLES[idx % CHIP_STYLES.length];
                return (
                  <button
                    key={c.id}
                    className={cn("px-5 py-2 rounded-[8px] text-sh6 font-semibold shadow-sm", s.bg, s.text)}
                    type="button"
                  >
                    {c.subject}
                  </button>
                );
              })}
              {classes.length === 0 && !loadingData && (
                 <div className="text-gray-500 text-sm">Belum bergabung dengan kelas apapun.</div>
              )}
            </div>

            {/* Latest Announcement (Top 3 Display) */}
            <section>
              <h2 className="text-sh3 font-extrabold text-gray-900 mb-4">Latest Announcement</h2>

              {announcements.length === 0 ? (
                  <div className="text-gray-500 italic">Tidak ada pengumuman terbaru.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {announcements.slice(0, 3).map((a, i) => (
                        <div
                        key={a.id}
                        className="bg-white rounded-2xl w-76 h-fit shadow-[0_16px_30px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col justify-between"
                        >
                        <div className="p-5">
                            <h3 className="font-extrabold text-blue-100 text-sh6 line-clamp-2" title={a.title}>
                                {a.title}
                            </h3>

                            <p className="mt-1 text-sh8 text-black">
                            <span className="font-semibold text-blue-base">
                                {a.author}
                            </span>
                            {" | "}
                            {prettyPublished(a.createdAt)}
                            </p>

                            <div className="mt-3 text-b7 leading-relaxed text-blue-100 line-clamp-3">
                                {a.excerpt}
                            </div>
                        </div>

                        <div className="px-5 pb-5">
                            <button
                            onClick={() => openAnnouncementDrawer(a.id)}
                            className="block w-full text-center rounded-[8px] bg-yellow-base text-yellow-90 font-normal text-b8 py-2.5 hover:brightness-95"
                            >
                            Lihat Selengkapnya
                            </button>
                        </div>
                        </div>
                    ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Calendar + Reminder */}
          <aside className="space-y-5 min-w-[300px]">
            {/* Calendar */}
            <div className="bg-transparent">
              <div className="flex items-center justify-end gap-2 mb-2">
                <button
                  type="button"
                  className="h-7 w-7 rounded-full hover:bg-white/60 flex items-center justify-center"
                  onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                  aria-label="Prev month"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>

                <div className="text-sh5 font-bold text-gray-900">
                  {format(monthCursor, "MMMM yyyy", { locale: indonesia })}
                </div>

                <button
                  type="button"
                  className="h-7 w-7 rounded-full hover:bg-white/60 flex items-center justify-center"
                  onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-[11px] text-gray-700">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
                  <div key={w} className="text-center font-semibold opacity-70">
                    {w}
                  </div>
                ))}

                {calendarDays.map((d, idx) => {
                  const inMonth = isSameMonth(d, monthCursor);
                  const selected = isSameDay(d, selectedDate);
                  
                  // LOGIC: Cek apakah tanggal ini ada deadline assignment yg Ongoing
                  const hasDeadline = assignments.some(a => 
                      a.dueDate && 
                      isSameDay(a.dueDate.toDate(), d) && 
                      isSameYear(a.dueDate.toDate(), d) &&
                      a.status === 'ongoing'
                  );

                  return (
                    <button
                      key={`${d.toISOString()}-${idx}`}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "h-7 w-7 rounded-full text-center flex items-center justify-center font-semibold transition-all",
                        inMonth ? "text-gray-900" : "text-gray-400",
                        // Logic warna biru jika ada deadline (sesuai request)
                        hasDeadline && inMonth && !selected ? "text-[#3D5AFE] font-extrabold ring-1 ring-[#3D5AFE]/20" : "",
                        selected ? "bg-[#3D5AFE] text-white shadow-md" : "hover:bg-white/70"
                      )}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reminder List based on Selected Date */}
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 mb-3">
                 Deadlines: {format(selectedDate, "dd MMM", { locale: indonesia })}
              </h3>

              <div className="space-y-3 flex flex-col items-between min-h-[100px]">
                {assignmentsOnSelectedDate.length === 0 ? (
                    <div className="text-xs text-gray-500 py-2">Tidak ada deadline tugas ongoing.</div>
                ) : (
                    assignmentsOnSelectedDate.map((r, i) => (
                    <div
                        key={r.id + i}
                        className="w-full rounded-xl bg-[#3D5AFE] text-white px-4 py-3 flex items-center justify-between shadow-[0_12px_24px_rgba(61,90,254,0.25)] hover:brightness-95 cursor-pointer"
                    >
                        <div className="text-left overflow-hidden">
                        <div className="text-xs font-extrabold truncate pr-2">{r.title}</div>
                        <div className="text-[10px] opacity-85">
                             {r.dueDate ? format(r.dueDate.toDate(), "HH:mm") : "No Time"} • {r.subject}
                        </div>
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-90 shrink-0" />
                    </div>
                    ))
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Latest Assignment Lists */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold text-gray-900">Latest Assignment</h2>
            <Link href="/assignments" className="text-xs font-bold text-[#FFD54F] hover:underline">
              Lihat Selengkapnya
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* On Going */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">On Going</div>
              <div className="space-y-4">
                {visualAssignments.ongoing.length === 0 ? <p className="text-center text-xs text-gray-400">No ongoing tasks</p> : 
                visualAssignments.ongoing.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="font-semibold text-sh6 text-black line-clamp-2">{t.title}</div>
                    <div className="text-b9 text-blue-100 mt-1">
                      {t.subject}
                      {t.publishedAt ? ` | Published on ${prettyPublished(t.publishedAt)}` : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <span className="text-b9 font-semibold text-blue-base">
                        Due: {t.dueDate ? format(t.dueDate.toDate(), "dd MMM HH:mm", {locale: indonesia}) : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Graded */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">Graded</div>
              <div className="space-y-4">
                {visualAssignments.graded.length === 0 ? <p className="text-center text-xs text-gray-400">No graded tasks</p> : 
                visualAssignments.graded.map((t) => {
                  return (
                    <div key={t.id} className="relative group">
                      {/* CARD NORMAL */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 transition-opacity duration-150 group-hover:opacity-0">
                        <div className="flex-1">
                          <div className="font-semibold text-sh6 text-black line-clamp-2">{t.title}</div>
                          <div className="text-b9 text-blue-100 mt-1">
                            {t.subject}
                          </div>
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex flex-col items-center justify-center border border-[#DDE3FF] shrink-0">
                          <div className="text-lg leading-none font-extrabold text-[#3D5AFE]">{t.score || 0}</div>
                          <div className="text-[10px] font-bold text-[#3D5AFE] opacity-80">Score</div>
                        </div>
                      </div>

                      {/* HOVER PANEL */}
                      <div
                          className={cn(
                            "absolute left-0 top-0 w-full z-30",
                            "opacity-0 pointer-events-none transition-opacity duration-150",
                            "group-hover:opacity-100 group-hover:pointer-events-auto"
                          )}
                        >
                        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_16px_30px_rgba(0,0,0,0.10)] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-[20px] leading-snug font-extrabold text-black line-clamp-2">
                                {t.title}
                              </div>
                              <div className="mt-2 text-[12px] leading-snug text-black">
                                <div>{t.subject}</div>
                                <div>Published on {prettyPublished(t.publishedAt)}</div>
                              </div>
                            </div>

                            <div className="w-[70px] h-[70px] rounded-2xl bg-[#EEF2FF] flex flex-col items-center justify-center border border-[#DDE3FF] shrink-0">
                              <div className="text-[30px] leading-none font-extrabold text-[#3D5AFE]">
                                {t.score || 0}
                              </div>
                              <div className="text-[11px] font-semibold text-[#3D5AFE] opacity-90">
                                Score
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="mt-4 w-full h-[40px] rounded-xl bg-[#6C63FF] text-white font-medium text-[14px] hover:brightness-95"
                            onClick={() => router.push(`/assignments/${t.id}/feedback`)}
                          >
                            See Feedback
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submitted */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">Submitted</div>
              <div className="space-y-4">
                {visualAssignments.submitted.length === 0 ? <p className="text-center text-xs text-gray-400">No submitted tasks</p> :
                visualAssignments.submitted.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="font-semibold text-sh6 text-black line-clamp-2">{t.title}</div>
                    <div className="text-b9 text-blue-100 mt-1">
                      {t.subject}
                    </div>
                    <div className="mt-3 text-right">
                      <span className="text-b9 font-semibold text-blue-base">
                        Submitted on{" "}
                        {prettyPublished(t.submittedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Rekomendasi Bahan Belajar (By Lynx) */}
        <section className="mt-12">
          <div className="mb-4">
            <h2 className="text-sh3 font-bold text-black">Rekomendasi Bahan Belajar</h2>
            <p className="text-sh4 text-black font-normal">
              By{" "}
              <span className="font-extrabold bg-linear-to-r from-[#46C8FF] to-[#2A7899] bg-clip-text text-transparent">
                Lynx
              </span>
            </p>
          </div>

          <div className="space-y-4">
             {/* Jika Lynx Loading */}
             {loadingLynx && <p className="text-sm text-gray-500">Menganalisis performa belajar...</p>}
             
             {/* Jika Ada Data */}
             {!loadingLynx && lynxData?.recommendations?.map((rec, i) => (
                <Link key={i} href={rec.resource_link || "#"} target="_blank" rel="noreferrer" className="block">
                  <div className={cn("rounded-2xl px-6 py-5 text-white shadow hover:brightness-95 flex items-center justify-between", i%2 === 0 ? "bg-[#3D5AFE]" : "bg-[#6C63FF]")}>
                    <div>
                      <div className="font-extrabold text-sm">
                        {rec.advice}
                      </div>
                      <div className="text-[11px] opacity-85 mt-1">
                        {rec.subject}
                      </div>
                    </div>
                    <ArrowRight className="h-6 w-6" />
                  </div>
                </Link>
             ))}

            {errorLynx && (
              <div className="text-xs text-red-600 font-bold">
                {errorLynx}{" "}
                <button type="button" onClick={fetchLynxAnalysis} className="underline">
                  Refresh
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Avatar */}
      <button
        type="button"
        className="fixed right-8 bottom-8 h-14 w-14 rounded-full bg-[#FFD54F] border-[6px] border-[#3D5AFE] shadow-[0_18px_40px_rgba(0,0,0,0.15)] flex items-center justify-center"
        aria-label="Profile"
        onClick={() => router.push("/profile")}
      >
        <span className="font-extrabold text-[#5D4037] text-lg">{safeInitial(userProfile?.displayName)}</span>
      </button>

      {/* Announcement Right Drawer */}
      {isAnnDrawerOpen && activeAnnouncement && (
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label="Close announcement" onClick={closeAnnouncementDrawer} className="absolute inset-0 bg-black/20" />

          <div className="absolute right-0 top-0 h-full w-[420px] max-w-[92vw] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] border-l border-gray-200 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-black text-lg leading-snug">
                    {activeAnnouncement.title}
                  </h3>

                  <p className="mt-1 text-sm text-black">
                    <span className="font-semibold text-blue-base">By {activeAnnouncement.author}</span>
                    {" | "}
                    Published on{" "}
                    {prettyPublished(activeAnnouncement.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAnnouncementDrawer}
                  className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-gray-700" />
                </button>
              </div>

              <div className="mt-5 text-sm leading-relaxed text-black whitespace-pre-line">
                {activeAnnouncement.content || activeAnnouncement.excerpt}
              </div>

              {activeAnnouncement.attachments && activeAnnouncement.attachments.length > 0 && (
                <div className="mt-8">
                    <div className="font-extrabold text-sm text-black mb-3">Lampiran</div>

                    <div className="space-y-3">
                    {activeAnnouncement.attachments.map(
                        (att, idx) => (
                        <div key={`${att.name}-${idx}`} className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-base" />
                            {att.url && att.url !== "#" ? (
                            <Link href={att.url} target="_blank" rel="noreferrer" className="text-blue-base underline text-sm">
                                {att.name}
                            </Link>
                            ) : (
                            <span className="text-blue-base text-sm">{att.name}</span>
                            )}
                        </div>
                        )
                    )}
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}