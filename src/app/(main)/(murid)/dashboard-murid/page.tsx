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
  isSameDay,
} from "date-fns";
import { id as indonesia } from "date-fns/locale";
import { Bell, ChevronLeft, ChevronRight, Search, ArrowRight, FileText } from "lucide-react";

// Shadcn Dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Firebase
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
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

interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate?: Timestamp | null;
  status: AssignmentStatus;
  score?: number | null;
  submittedAt?: Timestamp | null;
  author?: string | null;
  publishedAt?: Timestamp | null;
}

type AnnouncementAttachment = {
  name: string;
  url: string;
};

interface Announcement {
  id: string;
  title: string;
  author: string;
  publishedAt?: Timestamp | null;
  excerpt: string;
  content?: string;
  attachments?: AnnouncementAttachment[];
  href?: string;
}

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
  { bg: "bg-[#3D5AFE]", text: "text-white" }, // biru
  { bg: "bg-[#FFD54F]", text: "text-[#5D4037]" }, // kuning
  { bg: "bg-[#6C63FF]", text: "text-white" }, // ungu
];

function safeInitial(name?: string | null) {
  const s = (name || "").trim();
  return s.length ? s[0].toUpperCase() : "S";
}

function prettyPublished(ts?: Timestamp | null) {
  if (!ts) return "—";
  return format(ts.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia });
}

const WIB_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toJakartaDateKey(date: Date) {
  const parts = WIB_FMT.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function makeExcerpt(text: string, max = 180) {
  const t = (text || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "...";
}

function safeParseDate(str?: string | null) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // lynx
  const [lynxData, setLynxData] = useState<LynxAnalysisResult | null>(null);
  const [loadingLynx, setLoadingLynx] = useState(false);
  const [errorLynx, setErrorLynx] = useState<string | null>(null);

  // calendar
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date(2026, 4, 1));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(2026, 4, 8));

  // ---------- ANNOUNCEMENT DIALOG STATE ----------
  const [isAnnDialogOpen, setIsAnnDialogOpen] = useState(false);
  const [activeAnnouncementId, setActiveAnnouncementId] = useState<string | null>(null);

  const openAnnouncementDialog = (id: string) => {
    setActiveAnnouncementId(id);
    setIsAnnDialogOpen(true);
  };

  const closeAnnouncementDialog = () => {
    setIsAnnDialogOpen(false);
  };

  // ---------- AUTH CHECK ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);

        let grade = "12 SMA";
        let photo = currentUser.photoURL;
        let displayName = currentUser.displayName || "Siswa";

        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.grade_level) grade = data.grade_level;
          if (data.photoURL) photo = data.photoURL;
          if (data.nama) displayName = data.nama;
          if (data.displayName) displayName = data.displayName;
        }

        setUserProfile({
          uid: currentUser.uid,
          displayName,
          grade_level: grade,
          photoURL: photo,
        });
      } catch {
        setUserProfile({
          uid: currentUser.uid,
          displayName: currentUser.displayName || "Siswa",
          grade_level: "12 SMA",
          photoURL: currentUser.photoURL,
        });
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ---------- DATA FETCH ----------
  useEffect(() => {
    if (!userProfile) return;

    const fetchAll = async () => {
      setLoadingData(true);
      try {
        // 1) CLASSES joined via subcollection students
        const classesRef = collection(db, "classes");
        const classSnapshot = await getDocs(classesRef);

        const joined: StudentClass[] = [];
        for (const c of classSnapshot.docs) {
          const studentDoc = doc(db, "classes", c.id, "students", userProfile.uid);
          const sSnap = await getDoc(studentDoc);
          if (!sSnap.exists()) continue;

          const d = c.data() as any;
          joined.push({
            id: c.id,
            name: d.name || "Kelas Tanpa Nama",
            subject: d.subject || d.name || "Umum",
            teacherName: d.teacherName || "Guru",
            schedule: d.schedule || "Jadwal belum diatur",
            studentCount: typeof d.studentCount === "number" ? d.studentCount : 0,
          });
        }
        setClasses(joined);

        // 2) ANNOUNCEMENTS: last 5 across all joined classes (by createdAt)
        const annAll: Announcement[] = [];

        for (const cls of joined) {
          const annRef = collection(db, "classes", cls.id, "announcements");
          const annQ = query(annRef, orderBy("createdAt", "desc"), limit(5));
          const annSnap = await getDocs(annQ);

          annSnap.forEach((aDoc) => {
            const a = aDoc.data() as any;
            const createdAt: Timestamp | null = a.createdAt ?? null;
            const content: string = a.content || "";

            const attachments: AnnouncementAttachment[] = [];
            if (a.fileUrl) {
              attachments.push({
                name: typeof a.fileName === "string" && a.fileName.trim() ? a.fileName : "Lampiran",
                url: a.fileUrl,
              });
            }

            annAll.push({
              id: aDoc.id,
              title: a.title || "Pengumuman",
              author: `${cls.name}${cls.teacherName ? ` - ${cls.teacherName}` : ""}`,
              publishedAt: createdAt,
              excerpt: makeExcerpt(content, 180),
              content,
              attachments: attachments.length ? attachments : undefined,
              href: "#",
            });
          });
        }

        annAll.sort((x, y) => {
          const tx = x.publishedAt ? x.publishedAt.toMillis() : 0;
          const ty = y.publishedAt ? y.publishedAt.toMillis() : 0;
          return ty - tx;
        });

        setAnnouncements(annAll.slice(0, 5));

        // 3) ASSIGNMENTS: nested in chapters/subchapters, join submissions
        const subsSnap = await getDocs(
          query(collection(db, "submissions"), where("studentId", "==", userProfile.uid))
        );
        const subMap = new Map<string, any>();
        subsSnap.forEach((s) => subMap.set(s.data().assignmentId, s.data()));

        const now = new Date();
        const allAssignments: Assignment[] = [];

        for (const cls of joined) {
          const chSnap = await getDocs(collection(db, "classes", cls.id, "chapters"));

          chSnap.forEach((ch) => {
            const chData = ch.data() as any;
            const subchapters = Array.isArray(chData.subchapters) ? chData.subchapters : [];

            subchapters.forEach((sub: any) => {
              const arr = Array.isArray(sub?.assignments) ? sub.assignments : [];

              arr.forEach((a: any) => {
                if (typeof a?.status === "string" && a.status.toLowerCase() !== "published") return;

                const assignmentId = a.id;
                if (!assignmentId) return;

                const deadlineDate = safeParseDate(a.deadline);
                if (!deadlineDate) return;

                const submission = subMap.get(assignmentId);

                let status: AssignmentStatus = "ongoing";
                let score: number | null = null;
                let submittedAt: Timestamp | null = null;

                if (submission) {
                  status = submission.status === "GRADED" ? "graded" : "submitted";
                  score = typeof submission.score === "number" ? submission.score : null;
                  submittedAt = submission.submittedAt ?? null;
                } else {
                  if (now > deadlineDate) return;
                }

                let pubTs: Timestamp | null = null;
                if (a.publishedAt) {
                  if (typeof a.publishedAt === "string") {
                    const d = safeParseDate(a.publishedAt);
                    pubTs = d ? Timestamp.fromDate(d) : null;
                  } else if (a.publishedAt instanceof Timestamp) {
                    pubTs = a.publishedAt;
                  }
                } else if (a.createdAt) {
                  if (typeof a.createdAt === "string") {
                    const d = safeParseDate(a.createdAt);
                    pubTs = d ? Timestamp.fromDate(d) : null;
                  } else if (a.createdAt instanceof Timestamp) {
                    pubTs = a.createdAt;
                  }
                }

                allAssignments.push({
                  id: assignmentId,
                  title: a.title || "Tugas",
                  subject: `By ${cls.name}${cls.teacherName ? ` - ${cls.teacherName}` : ""}`,
                  dueDate: Timestamp.fromDate(deadlineDate),
                  status,
                  score,
                  submittedAt,
                  author: cls.teacherName || null,
                  publishedAt: pubTs,
                });
              });
            });
          });
        }

        allAssignments.sort((x, y) => {
          const ax = x.dueDate ? x.dueDate.toMillis() : Number.MAX_SAFE_INTEGER;
          const ay = y.dueDate ? y.dueDate.toMillis() : Number.MAX_SAFE_INTEGER;
          return ax - ay;
        });

        setAssignments(allAssignments);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAll();
    fetchLynxAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  // ---------- LYNX FETCH ----------
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
      if (!data.weaknesses || !data.recommendations) throw new Error("Format data tidak sesuai");

      setLynxData(data);
    } catch {
      setLynxData(null);
    } finally {
      setLoadingLynx(false);
    }
  };

  // Latest Announcement max 5 (seadanya)
  const visualAnnouncements = useMemo<Announcement[]>(() => announcements.slice(0, 5), [announcements]);

  const activeAnnouncement = useMemo(() => {
    if (!activeAnnouncementId) return null;
    return visualAnnouncements.find((a) => a.id === activeAnnouncementId) || null;
  }, [activeAnnouncementId, visualAnnouncements]);

  // Assignment grouping
  const visualAssignments = useMemo(() => {
    const ongoing = assignments.filter((a) => a.status === "ongoing").slice(0, 3);
    const graded = assignments.filter((a) => a.status === "graded").slice(0, 2);
    const submitted = assignments.filter((a) => a.status === "submitted").slice(0, 3);
    return { ongoing, graded, submitted };
  }, [assignments]);

  const classChips = useMemo(() => classes.slice(0, 3).map((c) => ({ id: c.id, name: c.subject || c.name })), [classes]);

  // Calendar marks (ongoing deadlines -> blue text)
  const ongoingDeadlineKeySet = useMemo(() => {
    const set = new Set<string>();
    assignments
      .filter((a) => a.status === "ongoing" && a.dueDate)
      .forEach((a) => {
        const ddl = a.dueDate!.toDate();
        const ddlSafe = new Date(ddl.getFullYear(), ddl.getMonth(), ddl.getDate(), 12, 0, 0);
        set.add(toJakartaDateKey(ddlSafe));
      });
    return set;
  }, [assignments]);

  // Reminder linked to selected date (ongoing only)
  const reminders = useMemo(() => {
    const selectedKey = toJakartaDateKey(selectedDate);

    const list = assignments
      .filter((a) => a.status === "ongoing" && a.dueDate)
      .filter((a) => {
        const due = a.dueDate!.toDate();
        const dueSafe = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 12, 0, 0);
        return toJakartaDateKey(dueSafe) === selectedKey;
      })
      .slice()
      .sort((x, y) => x.dueDate!.toMillis() - y.dueDate!.toMillis());

    return list.map((a) => {
      const due = a.dueDate!.toDate();
      return {
        id: a.id,
        title: a.title,
        sub: `Due Date: ${format(due, "EEE, d MMM • HH:mm", { locale: indonesia })}`,
      };
    });
  }, [assignments, selectedDate]);

  // Calendar grid
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3D5AFE] border-t-transparent" />
      </div>
    );
  }

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
            {/* Chips */}
            <div className="mt-4 flex flex-wrap gap-3 mb-4">
              {classChips.map((c, idx) => {
                const s = CHIP_STYLES[idx % CHIP_STYLES.length];
                return (
                  <button
                    key={c.id}
                    className={cn("px-5 py-2 rounded-[8px] text-sh6 font-semibold shadow-sm", s.bg, s.text)}
                    type="button"
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {/* Latest Announcement */}
            <section>
              <h2 className="text-sh3 font-extrabold text-gray-900 mb-4">Latest Announcement</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {visualAnnouncements.map((a, i) => (
                  <div
                    key={loadingData ? `sk-ann-${i}` : a.id}
                    className="bg-white rounded-2xl w-76 h-fit shadow-[0_16px_30px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden"
                  >
                    <div className="p-5">
                      <h3 className="font-extrabold text-blue-100 text-sh6">
                        {loadingData ? "—" : a.title}
                      </h3>

                      <p className="mt-1 text-sh8 text-black">
                        <span className="font-semibold text-blue-base">
                          By {loadingData ? "—" : a.author}
                        </span>
                        {" | "}
                        Published on{" "}
                        {loadingData
                          ? "—"
                          : a.publishedAt
                          ? format(a.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })
                          : "—"}
                      </p>

                      <div className="mt-3 text-b7 leading-relaxed text-blue-100 whitespace-pre-line ml-5">
                        {loadingData ? "—" : a.excerpt}
                      </div>
                    </div>

                    <div className="px-5 pb-5">
                      <Link
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!loadingData) openAnnouncementDialog(a.id);
                        }}
                        className="block w-full text-center rounded-[8px] bg-yellow-base text-yellow-90 font-normal text-b8 py-2.5 hover:brightness-95"
                      >
                        Lihat Selengkapnya
                      </Link>
                    </div>
                  </div>
                ))}

                {!loadingData && visualAnnouncements.length === 0 && (
                  <div className="text-[11px] text-gray-600">Belum ada announcement.</div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Calendar + Reminder */}
          <aside className="space-y-5">
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

                {calendarDays.map((d) => {
                  const cellSafe = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
                  const keyWib = toJakartaDateKey(cellSafe);

                  const hasDeadline = ongoingDeadlineKeySet.has(keyWib);
                  const selected = isSameDay(d, selectedDate);

                  return (
                    <button
                      key={`${keyWib}-${d.getDate()}`}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "h-7 w-7 rounded-full font-semibold",
                        selected && "bg-[#3D5AFE] text-white",
                        !selected && hasDeadline && "text-[#3D5AFE]"
                      )}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reminder */}
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 mb-3">Reminder</h3>

              <div className="space-y-3 flex flex-col items-between">
                {reminders.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full rounded-xl bg-[#3D5AFE] text-white px-4 py-3 flex items-center justify-between shadow-[0_12px_24px_rgba(61,90,254,0.25)] hover:brightness-95"
                  >
                    <div className="text-left">
                      <div className="text-xs font-extrabold">{r.title}</div>
                      <div className="text-[10px] opacity-85">{r.sub}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 opacity-90" />
                  </button>
                ))}

                {!reminders.length && !loadingData && (
                  <div className="text-[11px] text-gray-600">Tidak ada deadline di tanggal ini</div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Latest Assignment */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold text-gray-900">Latest Assignment</h2>
            <button type="button" className="text-xs font-bold text-[#FFD54F] hover:underline">
              Lihat Selengkapnya
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* On Going */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">On Going</div>
              <div className="space-y-4">
                {visualAssignments.ongoing.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="font-semibold text-sh6 text-black">{t.title}</div>
                    <div className="text-b9 text-blue-100 mt-1">
                      {t.subject}
                      {t.publishedAt ? ` | Published on ${prettyPublished(t.publishedAt)}` : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      {t.dueDate ? (
                        <span className="text-b9 font-semibold text-blue-base">
                          Due{" "}
                          {format(t.dueDate.toDate(), "dd MMM yyyy • HH:mm", {
                            locale: indonesia,
                          })}
                        </span>
                      ) : (
                        <span className="text-b9 font-semibold text-blue-base">—</span>
                      )}
                    </div>
                  </div>
                ))}
                {!visualAssignments.ongoing.length && (
                  <div className="text-[11px] text-gray-600 text-center">Tidak ada ongoing.</div>
                )}
              </div>
            </div>

            {/* Graded */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">Graded</div>
              <div className="space-y-4">
                {visualAssignments.graded.map((t) => {
                  const title = t.title || "—";
                  const authorLine = t.subject || "—";
                  const pubLine = t.publishedAt ? prettyPublished(t.publishedAt) : "—";
                  const scoreVal = typeof t.score === "number" ? t.score : 0;

                  return (
                    <div key={t.id} className="relative group">
                      {/* CARD NORMAL */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 transition-opacity duration-150 group-hover:opacity-0">
                        <div className="flex-1">
                          <div className="font-semibold text-sh6 text-black">{title}</div>
                          <div className="text-b9 text-blue-100 mt-1">
                            {authorLine}
                            {t.publishedAt ? ` | Published on ${pubLine}` : ""}
                          </div>
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex flex-col items-center justify-center border border-[#DDE3FF]">
                          <div className="text-lg leading-none font-extrabold text-[#3D5AFE]">{scoreVal}</div>
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
                              <div
                                className={cn(
                                  "text-[22px] leading-snug font-extrabold text-black",
                                  "overflow-hidden",
                                  "[display:-webkit-box]",
                                  "[-webkit-box-orient:vertical]",
                                  "[-webkit-line-clamp:2]"
                                )}
                              >
                                {title}
                              </div>

                              <div className="mt-2 text-[14px] leading-snug text-black">
                                <div>{authorLine}</div>
                                <div>Published on {pubLine}</div>
                              </div>
                            </div>

                            <div className="w-[78px] h-[78px] rounded-2xl bg-[#EEF2FF] flex flex-col items-center justify-center border border-[#DDE3FF] shrink-0">
                              <div className="text-[34px] leading-none font-extrabold text-[#3D5AFE]">{scoreVal}</div>
                              <div className="text-[13px] font-semibold text-[#3D5AFE] opacity-90">Score</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="mt-4 w-full h-[48px] rounded-xl bg-[#6C63FF] text-white font-medium text-[16px] hover:brightness-95"
                            onClick={() => router.push(`/assignments/${t.id}/feedback`)}
                          >
                            See Feedback
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!visualAssignments.graded.length && (
                  <div className="text-[11px] text-gray-600 text-center">Belum ada graded.</div>
                )}
              </div>
            </div>

            {/* Submitted */}
            <div>
              <div className="text-center text-sh5 font-semibold text-blue-60 mb-4">Submitted</div>
              <div className="space-y-4">
                {visualAssignments.submitted.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="font-semibold text-sh6 text-black">{t.title}</div>
                    <div className="text-b9 text-blue-100 mt-1">
                      {t.subject}
                      {t.publishedAt ? ` | Published on ${prettyPublished(t.publishedAt)}` : ""}
                    </div>
                    <div className="mt-3 text-right">
                      <span className="text-b9 font-semibold text-blue-base">
                        Submitted on{" "}
                        {t.submittedAt
                          ? format(t.submittedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
                {!visualAssignments.submitted.length && (
                  <div className="text-[11px] text-gray-600 text-center">Belum ada submitted.</div>
                )}
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
            <Link
              href={lynxData?.recommendations?.[0]?.resource_link || "https://www.youtube.com/watch?v=E86ckq8yLUU"}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="rounded-2xl px-6 py-5 bg-[#3D5AFE] text-white shadow-[0_16px_30px_rgba(61,90,254,0.25)] hover:brightness-95 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-sm">
                    {loadingLynx ? "—" : lynxData?.recommendations?.[0]?.advice || "Video Tutorial"}
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">
                    {loadingLynx
                      ? "—"
                      : lynxData?.recommendations?.[0]?.subject
                      ? `${lynxData.recommendations[0].subject}`
                      : "—"}
                  </div>
                </div>
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>

            <Link
              href={lynxData?.recommendations?.[1]?.resource_link || "#"}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="rounded-2xl px-6 py-5 bg-[#6C63FF] text-white shadow-[0_16px_30px_rgba(108,99,255,0.25)] hover:brightness-95 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-sm">
                    {loadingLynx ? "—" : lynxData?.recommendations?.[1]?.advice || "Flashcards"}
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">
                    {loadingLynx
                      ? "—"
                      : lynxData?.recommendations?.[1]?.subject
                      ? `${lynxData.recommendations[1].subject}`
                      : "—"}
                  </div>
                </div>
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>

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
        onClick={() => router.push("/chat")}
      >
        <span className="font-extrabold text-[#5D4037] text-lg">{safeInitial(userProfile?.displayName)}</span>
      </button>

      {/* Announcement Modal (Shadcn Dialog) */}
      <Dialog open={isAnnDialogOpen} onOpenChange={(v) => (v ? setIsAnnDialogOpen(true) : closeAnnouncementDialog())}>
        <DialogContent className="sm:max-w-[860px] p-0 overflow-hidden">
          <div className="p-10">
            <DialogHeader>
              <DialogTitle className="text-[30px] font-extrabold text-blue-100 leading-tight">
                {activeAnnouncement?.title || "—"}
              </DialogTitle>

              <DialogDescription className="text-[16px] text-blue-100 mt-2">
                <span className="font-semibold text-blue-base">
                  By {activeAnnouncement?.author || "—"}
                </span>{" "}
                | Published on{" "}
                {activeAnnouncement?.publishedAt
                  ? format(activeAnnouncement.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })
                  : "—"}
              </DialogDescription>
            </DialogHeader>

            {/* Body (scrollable like modal umum) */}
            <div className="mt-8 max-h-[62vh] overflow-y-auto pr-2">
              <div className="text-[18px] leading-[1.9] text-blue-100 whitespace-pre-line">
                {activeAnnouncement?.content || activeAnnouncement?.excerpt || "—"}
              </div>

              {/* Attachments */}
              <div className="mt-12">
                <div className="text-[22px] font-extrabold text-blue-100 mb-4">Lampiran</div>

                <div className="space-y-3">
                  {(activeAnnouncement?.attachments?.length ? activeAnnouncement.attachments : []).map((att, idx) => (
                    <div key={`${att.name}-${idx}`} className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-blue-base" />
                      <Link
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-base underline text-[18px]"
                      >
                        {att.name}
                      </Link>
                    </div>
                  ))}

                  {!activeAnnouncement?.attachments?.length && (
                    <div className="text-[16px] text-blue-100 opacity-70">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
