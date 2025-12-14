"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from "date-fns";
import { id as indonesia } from "date-fns/locale";
import { Bell, ChevronLeft, ChevronRight, Search, ArrowRight } from "lucide-react";

// Firebase
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";

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

interface Announcement {
  id: string;
  title: string;
  author: string;
  publishedAt?: Timestamp | null;
  excerpt: string;
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

  // calendar (dibikin default May 2026 agar sama screenshot)
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date(2026, 4, 1)); // May 2026
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(2026, 4, 8)); // highlight 8 (mirip screenshot)

  // ---------- AUTH CHECK ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const userDocRef = collection(db, "users");
        const q = query(userDocRef, where("uid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        let grade = "12 SMA";
        let photo = currentUser.photoURL;

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          if (data.grade_level) grade = data.grade_level;
          if (data.photoURL) photo = data.photoURL;
        }

        setUserProfile({
          uid: currentUser.uid,
          displayName: currentUser.displayName || "Siswa",
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
        // 1) Classes
        const classesRef = collection(db, "classes");
        const qClasses = query(classesRef, where("students", "array-contains", userProfile.uid));
        const classSnapshot = await getDocs(qClasses);

        const fetchedClasses: StudentClass[] = classSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Kelas Tanpa Nama",
          subject: doc.data().subject || "Umum",
          teacherName: doc.data().teacherName || "Guru",
          schedule: doc.data().schedule || "Jadwal belum diatur",
          studentCount: doc.data().students?.length || 0,
        }));
        setClasses(fetchedClasses);

        // 2) Assignments (ambil banyak biar bisa dibagi 3 kolom)
        const classIds = fetchedClasses.map((c) => c.id).slice(0, 10);
        if (classIds.length > 0) {
          const assignmentsRef = collection(db, "assignments");

          // catatan: Firestore "in" butuh array <= 10 (sudah di-slice)
          const qAssignments = query(
            assignmentsRef,
            where("classId", "in", classIds),
            orderBy("dueDate", "asc"),
            limit(20)
          );

          const assignSnapshot = await getDocs(qAssignments);

          const fetchedAssignments: Assignment[] = assignSnapshot.docs.map((doc) => {
            const d = doc.data();

            // Kalau status tidak tersedia, default ongoing supaya UI tetap hidup
            const statusRaw = (d.status || "ongoing") as AssignmentStatus;

            return {
              id: doc.id,
              title: d.title || "TK2 Kalkulus",
              subject: d.subjectName || d.subject || "Kalkulus 1",
              dueDate: d.dueDate ?? null,
              status: statusRaw,
              score: typeof d.score === "number" ? d.score : null,
              submittedAt: d.submittedAt ?? null,
              author: d.author || d.teacherName || "Prof. Okky",
              publishedAt: d.publishedAt ?? null,
            };
          });

          setAssignments(fetchedAssignments);
        } else {
          setAssignments([]);
        }

        // 3) Announcements (kalau collection tidak ada, fallback dummy)
        try {
          const annRef = collection(db, "announcements");
          const qAnn = query(annRef, orderBy("publishedAt", "desc"), limit(3));
          const annSnap = await getDocs(qAnn);

          const fetchedAnn: Announcement[] = annSnap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              title: d.title || "Revisi Berkas TK2 Kalkulus",
              author: d.author || "Kalkulus 1 - Prof. Okky",
              publishedAt: d.publishedAt ?? null,
              excerpt:
                d.excerpt ||
                "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.",
              href: d.href || "#",
            };
          });

          // Kalau kosong, biarkan; nanti fallback dummy via useMemo
          setAnnouncements(fetchedAnn);
        } catch {
          setAnnouncements([]);
        }
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

  // ---------- FALLBACK DATA (untuk menjaga UI tetap “persis” screenshot) ----------
  const visualAnnouncements = useMemo<Announcement[]>(() => {
    if (announcements.length >= 3) return announcements.slice(0, 3);
    return [
      {
        id: "a1",
        title: "Revisi Berkas TK2 Kalkulus",
        author: "Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        excerpt:
          "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.\n\nLorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        href: "#",
      },
      {
        id: "a2",
        title: "Revisi Berkas TK2 Kalkulus",
        author: "Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        excerpt:
          "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.\n\nLorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        href: "#",
      },
      {
        id: "a3",
        title: "Revisi Berkas TK2 Kalkulus",
        author: "Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        excerpt:
          "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.\n\nLorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        href: "#",
      },
    ];
  }, [announcements]);

  const visualAssignments = useMemo(() => {
    // kalau kamu punya status di Firestore, ini langsung kepakai.
    // kalau tidak, UI tetap mirip screenshot via fallback.
    const ongoing = assignments.filter((a) => a.status === "ongoing");
    const graded = assignments.filter((a) => a.status === "graded");
    const submitted = assignments.filter((a) => a.status === "submitted");

    // fallback dummy agar 3 kolom terisi seperti screenshot
    const dOngoing: Assignment[] = [
      {
        id: "o1",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        dueDate: Timestamp.fromDate(new Date(2025, 10, 16, 23, 59)),
        status: "ongoing",
      },
      {
        id: "o2",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        dueDate: Timestamp.fromDate(new Date(2025, 10, 16, 23, 59)),
        status: "ongoing",
      },
      {
        id: "o3",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        dueDate: Timestamp.fromDate(new Date(2025, 10, 16, 23, 59)),
        status: "ongoing",
      },
    ];

    const dGraded: Assignment[] = [
      {
        id: "g1",
        title: "TK2 Kalkulus - Integral & Aplikasinya",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        status: "graded",
        score: 98,
      },
      {
        id: "g2",
        title: "TK2 Kalkulus - Integral & Aplikasinya",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        status: "graded",
        score: 98,
      },
    ];

    const dSubmitted: Assignment[] = [
      {
        id: "s1",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        status: "submitted",
        submittedAt: Timestamp.fromDate(new Date(2025, 10, 9, 23, 56)),
      },
      {
        id: "s2",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        status: "submitted",
        submittedAt: Timestamp.fromDate(new Date(2025, 10, 9, 23, 56)),
      },
      {
        id: "s3",
        title: "TK2 Kalkulus",
        subject: "By Kalkulus 1 - Prof. Okky",
        publishedAt: Timestamp.fromDate(new Date(2025, 10, 9, 9, 30)),
        status: "submitted",
        submittedAt: Timestamp.fromDate(new Date(2025, 10, 9, 23, 56)),
      },
    ];

    const out = {
      ongoing: ongoing.length ? ongoing.slice(0, 3) : dOngoing,
      graded: graded.length ? graded.slice(0, 2) : dGraded,
      submitted: submitted.length ? submitted.slice(0, 3) : dSubmitted,
    };

    return out;
  }, [assignments]);

  const classChips = useMemo(() => {
    const fallback = [
      { id: "c1", name: "Matematika Diskret" },
      { id: "c2", name: "Kalkulus 1" },
      { id: "c3", name: "Dasar-Dasar Pemrograman" },
    ];

    const base = classes.length
      ? classes.slice(0, 3).map((c) => ({ id: c.id, name: c.subject || c.name }))
      : fallback;

    return base;
  }, [classes]);

  // ---------- CALENDAR GRID ----------
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

  // ---------- LOADING AUTH ----------
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3D5AFE] border-t-transparent" />
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-[#F3F6FF]">

      {/* MAIN */}
      <main className="mx-20 px-6 py-8">
        {/* Welcome + Search + Bell */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-[42px] leading-tight font-extrabold bg-linear-to-r from-blue-20 via-blue-40 to-blue-base bg-clip-text text-transparent w-fit">
              Welcome Again, {userProfile?.displayName || "Siswa"}!
            </h1>
          </div>

          {/* Search + Bell */}
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
                    className={cn(
                      "px-5 py-2 rounded-[8px] text-sh6 font-semibold shadow-sm",
                      s.bg,
                      s.text
                    )}
                    type="button"
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            {/* LEFT: Latest Announcement */}
            <section>
              <h2 className="text-sh3 font-extrabold text-gray-900 mb-4">Latest Announcement</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(loadingData ? [0, 1, 2] : [0, 1, 2]).map((i) => {
                  const a = visualAnnouncements[i];
                  return (
                    <div
                      key={loadingData ? `sk-ann-${i}` : a.id}
                      className="bg-white rounded-2xl w-76 h-fit shadow-[0_16px_30px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden"
                    >
                      <div className="p-5">
                        <h3 className="font-extrabold text-blue-100 text-sh6">
                          {loadingData ? "Revisi Berkas TK2 Kalkulus" : a.title}
                        </h3>

                        <p className="mt-1  text-sh8 text-black">
                          <span className="font-semibold text-blue-base">
                            By {loadingData ? "Kalkulus 1 - Prof. Okky" : a.author}
                          </span>
                          {" | "}
                          Published on{" "}
                          {loadingData
                            ? "09 Nov 2025 - 09:30"
                            : a.publishedAt
                            ? format(a.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })
                            : "—"}
                        </p>

                        <div className="mt-3 text-b7 leading-relaxed text-blue-100 whitespace-pre-line ml-5">
                          {loadingData ? (
                            <>
                              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut
                              labore.
                              {"\n\n"}
                              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut
                              labore et dolore magna aliqua.
                            </>
                          ) : (
                            a.excerpt
                          )}
                        </div>
                      </div>

                      <div className="px-5 pb-5">
                        <Link
                          href={loadingData ? "#" : a.href || "#"}
                          className="block w-full text-center rounded-[8px] bg-yellow-base text-yellow-90 font-normal text-b8 py-2.5 hover:brightness-95"
                        >
                          Lihat Selengkapnya
                        </Link>
                      </div>
                    </div>
                  );
                })}
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

                {calendarDays.map((d, idx) => {
                  const inMonth = isSameMonth(d, monthCursor);
                  const selected = isSameDay(d, selectedDate);

                  return (
                    <button
                      key={`${d.toISOString()}-${idx}`}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "h-7 w-7 rounded-full text-center flex items-center justify-center font-semibold",
                        inMonth ? "text-gray-900" : "text-gray-400",
                        selected ? "bg-[#3D5AFE] text-white shadow-md" : "hover:bg-white/70"
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
                {[
                  { title: "Submit TK2 Kalkulus", sub: "Due Date: Today 23:59" },
                  { title: "Submit TK2 Kalkulus", sub: "Due Date: Today 23:59" },
                  { title: "Submit TK2 Kalkulus", sub: "Due Date: Today 23:59" },
                ].map((r, i) => (
                  <button
                    key={i}
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
                      {t.publishedAt
                        ? ` | Published on ${format(t.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })}`
                        : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <span className="text-b9 font-semibold text-blue-base">
                        {/* sengaja statik agar mirip screenshot */}
                        7 days 12 hours left
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
                {visualAssignments.graded.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-sh6 text-black">{t.title}</div>
                      <div className="text-b9 text-blue-100 mt-1">
                        {t.subject}
                        {t.publishedAt
                          ? ` | Published on ${format(t.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })}`
                          : ""}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex flex-col items-center justify-center border border-[#DDE3FF]">
                      <div className="text-lg leading-none font-extrabold text-[#3D5AFE]">{t.score ?? 98}</div>
                      <div className="text-[10px] font-bold text-[#3D5AFE] opacity-80">Score</div>
                    </div>
                  </div>
                ))}
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
                      {t.publishedAt
                        ? ` | Published on ${format(t.publishedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })}`
                        : ""}
                    </div>
                    <div className="mt-3 text-right">
                      <span className="text-b9 font-semibold text-blue-base">
                        Submitted on{" "}
                        {t.submittedAt
                          ? format(t.submittedAt.toDate(), "dd MMM yyyy - HH:mm", { locale: indonesia })
                          : "09 Nov 2025 - 23:56"}
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
              By <span className="font-extrabold bg-linear-to-r from-[#46C8FF] to-[#2A7899] bg-clip-text text-transparent">Lynx</span>
            </p>
          </div>

          {/* Banner style sesuai screenshot */}
          <div className="space-y-4">
            {/* 1 */}
            <Link
              href= "https://www.youtube.com/watch?v=E86ckq8yLUU" 
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="rounded-2xl px-6 py-5 bg-[#3D5AFE] text-white shadow-[0_16px_30px_rgba(61,90,254,0.25)] hover:brightness-95 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-sm">
                    {loadingLynx
                      ? "20 Latihan Soal Teknik Pengintegralan Parsial"
                      : lynxData?.recommendations?.[0]?.advice || "Video Tutorial Integral"}
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">
                    {loadingLynx
                      ? "Kalkulus 1 Chapter 4: Integral Tentu"
                      : lynxData?.recommendations?.[0]?.subject
                      ? `${lynxData.recommendations[0].subject}`
                      : "Integral"}
                  </div>
                </div>
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>

            {/* 2 */}
            <Link
              href={lynxData?.recommendations?.[1]?.resource_link || "#"}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="rounded-2xl px-6 py-5 bg-[#6C63FF] text-white shadow-[0_16px_30px_rgba(108,99,255,0.25)] hover:brightness-95 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-sm">
                    {loadingLynx
                      ? "FlashCards Fungsi Khusus Pada OOP"
                      : lynxData?.recommendations?.[1]?.advice || "FlashCards Fungsi Khusus Pada OOP"}
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">
                    {loadingLynx
                      ? "Dasar-Dasar Pemrograman | Chapter 8: Object Oriented Programming"
                      : lynxData?.recommendations?.[1]?.subject
                      ? `${lynxData.recommendations[1].subject}`
                      : "Dasar-Dasar Pemrograman | Chapter 8: Object Oriented Programming"}
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

      {/* Floating Avatar (kanan bawah) */}
      <button
        type="button"
        className="fixed right-8 bottom-8 h-14 w-14 rounded-full bg-[#FFD54F] border-[6px] border-[#3D5AFE] shadow-[0_18px_40px_rgba(0,0,0,0.15)] flex items-center justify-center"
        aria-label="Profile"
        onClick={() => router.push("/chat")}
      >
        <span className="font-extrabold text-[#5D4037] text-lg">{safeInitial(userProfile?.displayName)}</span>
      </button>
    </div>
  );
}