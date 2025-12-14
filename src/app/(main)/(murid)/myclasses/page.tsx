"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Bell, Search, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Attachment = { name: string; url: string };
type Status = "On Going" | "Submitted" | "Graded";

type Assignment = {
  id: string;
  tag: string; // "Kalkulus 1"
  title: string;
  publishedAt: string; // "Published on 09 Nov 2025 - 09:30"
  deadlineText: string; // "Deadline on 18 Nov 2025 - 23:59"
  instructions: string;
  attachments: Attachment[];
  submissionStatusLabel: string; // "No Attempt" / "Submitted" / etc
  timeRemaining: string; // "8 days 14 hours 30 mins"
  primaryActionLabel: string; // "Add Submission"
};

type ClassCard = {
  id: string;
  title: string;
  teacher: string;
  theme: "blue" | "purple" | "yellow";
  illustration: "matdis" | "ddp" | "kalkulus";
};

export default function MyAssignmentsHardcodedPage() {
  const data = useMemo(() => {
    const assignments: Assignment[] = [
      {
        id: "a1",
        tag: "Kalkulus 1",
        title: "Tugas Kelompok 2 Kalkulus",
        publishedAt: "Published on 09 Nov 2025 - 09:30",
        deadlineText: "Deadline on 18 Nov 2025 - 23:59",
        instructions:
          "Setiap kelompok mengerjakan tugas sebanyak 3 (tiga) topik, perhatikan topik mana saja yang kelompok Anda harus kerjakan. Berikut petunjuk pengerjaan tugas:\n\n" +
          "a. Kerjakan secara manual (tulis tangan di kertas HVS A4) dan terperinci dengan mengimplementasikan konsep turunan yang telah dipelajari dalam menyelesaikan soal yang diberikan. Untuk jawaban desimal yang didapat, lakukan pembulatan sampai 4 angka di belakang koma. Berikan rubrik penilaian rinci untuk jawaban Anda dengan total nilai 100.\n\n" +
          "b. Kerjakan dengan large language model (LLM) dan bandingkan hasilnya dengan hasil manual Anda. Berikut adalah lampiran pembagian kelompok dan soal yang harus dikerjakan.",
        attachments: [
          { name: "Pembagian Kelompok.pdf", url: "#" },
          { name: "Soal TK2 Kalkulus Sem Gasal.pdf", url: "#" },
        ],
        submissionStatusLabel: "No Attempt",
        timeRemaining: "8 days 14 hours 30 mins",
        primaryActionLabel: "Add Submission",
      },
      // duplikasi list kiri biar mirip screenshot
      {
        id: "a2",
        tag: "Kalkulus 1",
        title: "Tugas Kelompok 2 Kalkulus",
        publishedAt: "Published on 09 Nov 2025 - 09:30",
        deadlineText: "Deadline on 18 Nov 2025 - 23:59",
        instructions:
          "Instruksi tugas sama seperti di atas. (Dummy content untuk tampilan list)",
        attachments: [{ name: "Material.pdf", url: "#" }],
        submissionStatusLabel: "No Attempt",
        timeRemaining: "8 days 14 hours 30 mins",
        primaryActionLabel: "Add Submission",
      },
      {
        id: "a3",
        tag: "Kalkulus 1",
        title: "Tugas Kelompok 2 Kalkulus",
        publishedAt: "Published on 09 Nov 2025 - 09:30",
        deadlineText: "Deadline on 18 Nov 2025 - 23:59",
        instructions:
          "Instruksi tugas sama seperti di atas. (Dummy content untuk tampilan list)",
        attachments: [{ name: "Material.pdf", url: "#" }],
        submissionStatusLabel: "No Attempt",
        timeRemaining: "8 days 14 hours 30 mins",
        primaryActionLabel: "Add Submission",
      },
      {
        id: "a4",
        tag: "Kalkulus 1",
        title: "Tugas Kelompok 2 Kalkulus",
        publishedAt: "Published on 09 Nov 2025 - 09:30",
        deadlineText: "Deadline on 18 Nov 2025 - 23:59",
        instructions:
          "Instruksi tugas sama seperti di atas. (Dummy content untuk tampilan list)",
        attachments: [{ name: "Material.pdf", url: "#" }],
        submissionStatusLabel: "No Attempt",
        timeRemaining: "8 days 14 hours 30 mins",
        primaryActionLabel: "Add Submission",
      },
      {
        id: "a5",
        tag: "Kalkulus 1",
        title: "Tugas Kelompok 2 Kalkulus",
        publishedAt: "Published on 09 Nov 2025 - 09:30",
        deadlineText: "Deadline on 18 Nov 2025 - 23:59",
        instructions:
          "Instruksi tugas sama seperti di atas. (Dummy content untuk tampilan list)",
        attachments: [{ name: "Material.pdf", url: "#" }],
        submissionStatusLabel: "No Attempt",
        timeRemaining: "8 days 14 hours 30 mins",
        primaryActionLabel: "Add Submission",
      },
    ];

    const classes: ClassCard[] = [
      {
        id: "c1",
        title: "Matematika Diskret 1",
        teacher: "Prof. Ari Darrell Muljono",
        theme: "blue",
        illustration: "matdis",
      },
      {
        id: "c2",
        title: "Dasar-Dasar\nPemrograman 1",
        teacher: "Prof. Rahel Meilinda Aruan",
        theme: "purple",
        illustration: "ddp",
      },
      {
        id: "c3",
        title: "Kalkulus 1",
        teacher: "Prof. Rahel Meilinda Aruan",
        theme: "yellow",
        illustration: "kalkulus",
      },
    ];

    return { assignments, classes };
  }, []);

  const [filter, setFilter] = useState<Status>("On Going");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(data.assignments[0]?.id || "");

  const filtered = useMemo(() => {
    // hardcoded: filter hanya buat UI (supaya pill terasa hidup)
    const base = data.assignments.filter((a) =>
      a.title.toLowerCase().includes(search.toLowerCase())
    );
    // status ga beneran dipakai di data hardcoded, jadi biar realistis:
    if (filter === "On Going") return base;
    if (filter === "Submitted") return base.slice(0, Math.max(1, Math.floor(base.length / 2)));
    return base.slice(0, 1);
  }, [data.assignments, filter, search]);

  const selected = useMemo(() => {
    return data.assignments.find((a) => a.id === selectedId) || data.assignments[0];
  }, [data.assignments, selectedId]);

  const COLOR = {
    bg: "bg-[#F6F7FB]",
    hero: "text-[#B8B6FF]",
    pillShadow: "shadow-[0_18px_40px_rgba(0,0,0,0.10)]",
    panelShadow: "shadow-[0_18px_40px_rgba(0,0,0,0.08)]",
    olive: { active: "bg-[#80711A]", idle: "bg-[#B7A21F]" },
    blueBtn: "bg-[#3D5AFE] hover:bg-[#2F49E8]",
  };

  return (
    <div className={cn("min-h-screen", COLOR.bg)}>
      <div className="mx-20 px-6 py-10">
        {/* HERO + SEARCH */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <h1 className={cn("text-sh2 bg-linear-to-r from-blue-20 via-blue-40 to-blue-base bg-clip-text text-transparent font-extrabold leading-none w-fit")}>
            Let&rsquo;s Back On Track!
          </h1>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[420px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Material"
                className={cn(
                  "h-11 w-full rounded-full bg-white border-none outline-none px-5 pr-12 text-sm",
                  COLOR.pillShadow
                )}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>

            <button
              type="button"
              className={cn("h-11 w-11 rounded-full bg-white flex items-center justify-center", COLOR.pillShadow)}
              aria-label="notifications"
            >
              <Bell className="h-5 w-5 text-[#3D5AFE]" />
            </button>
          </div>
        </div>

        {/* TITLE + FILTER */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-3xl font-extrabold text-black">My Assignments</h2>

          <div className="flex items-center gap-3">
            {(["On Going", "Submitted", "Graded"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "px-5 py-2 rounded-full text-[12px] font-extrabold text-white transition-all",
                  filter === s
                    ? cn(COLOR.olive.active, "shadow-[0_10px_22px_rgba(128,113,26,0.35)]")
                    : cn(COLOR.olive.idle, "hover:brightness-95")
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* GRID */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT LIST */}
          <div className="lg:col-span-4">
            <div className={cn("bg-white", COLOR.panelShadow)}>
              <div className="max-h-[550px] overflow-auto">
                <div className="space-y-5">
                  {filtered.map((a) => {
                    const active = a.id === selected?.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 transition bg-white",
                          active ? "bg-addition-blue-50" : "hover:bg-[#E6E7EA]"
                        )}
                        type="button"
                      >
                        <div className="mb-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#3D5AFE] text-white text-[10px] font-extrabold">
                            {a.tag}
                          </span>
                        </div>

                        <div className="text-[14px] font-extrabold text-[#4A4A4A] leading-snug">
                          {a.title}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500 font-medium">{a.publishedAt}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT DETAIL */}
          <div className="lg:col-span-8">
            <div className={cn("bg-white  p-10", COLOR.panelShadow, "min-h-[520px]")}>
              <div className="mb-6">
                <h3 className="text-[18px] md:text-[20px] font-extrabold text-black">{selected.title}</h3>
                <p className="mt-1 text-[12px] text-gray-600 font-medium">{selected.deadlineText}</p>
              </div>

              <div className="text-[12px] text-[#4A4A4A] leading-relaxed whitespace-pre-line">
                {selected.instructions}
              </div>

              <div className="mt-6 space-y-2">
                {selected.attachments.map((f, idx) => (
                  <a
                    key={idx}
                    href={f.url}
                    className="flex items-center gap-2 text-[12px] text-black font-medium hover:underline w-fit"
                  >
                    <FileText className="w-4 h-4 text-black" />
                    {f.name}
                  </a>
                ))}
              </div>

              <div className="mt-8 border-t border-gray-300/60" />

              <div className="mt-6">
                <div className="w-full border border-gray-300/70">
                  <div className="grid grid-cols-[220px_1fr]">
                    <div className="border-b border-gray-300/70 px-4 py-3 text-[12px] font-extrabold text-black">
                      Submission Status
                    </div>
                    <div className="border-b border-gray-300/70 px-4 py-3 text-[12px] font-medium text-black">
                      {selected.submissionStatusLabel}
                    </div>

                    <div className="px-4 py-3 text-[12px] font-extrabold text-black">Time Remaining</div>
                    <div className="px-4 py-3 text-[12px] font-medium text-black">{selected.timeRemaining}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-6 py-2 text-[12px] font-bold text-white inline-flex items-center gap-2",
                    COLOR.blueBtn,
                    "shadow-[0_14px_30px_rgba(61,90,254,0.25)]"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  {selected.primaryActionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MY CLASS */}
        <div className="mt-16">
          <h2 className="text-3xl font-extrabold text-black mb-8">My Class</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.classes.map((c) => (
              <div
                key={c.id}
                className={cn("bg-white rounded-2xl p-8 text-center", "shadow-[0_18px_40px_rgba(0,0,0,0.08)]")}
              >
                <div
                  className={cn(
                    "text-[20px] font-extrabold mb-1 whitespace-pre-line",
                    c.theme === "blue" ? "text-[#3D5AFE]" : c.theme === "purple" ? "text-[#6C63FF]" : "text-yellow-80"
                  )}
                >
                  {c.title}
                </div>

                <div className="text-[11px] text-gray-600 font-semibold mb-6">{c.teacher}</div>

                {/* Illustration placeholder: kalau belum ada asset, pakai svg sederhana biar tetap bagus */}
                <div className="h-40 flex items-center justify-center mb-6">
                  {c.illustration === "matdis" && (
                    <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
                      <circle cx="55" cy="60" r="8" fill="#3D5AFE" opacity="0.9" />
                      <circle cx="110" cy="40" r="8" fill="#3D5AFE" opacity="0.9" />
                      <circle cx="165" cy="60" r="8" fill="#3D5AFE" opacity="0.9" />
                      <circle cx="80" cy="105" r="8" fill="#3D5AFE" opacity="0.9" />
                      <circle cx="140" cy="105" r="8" fill="#3D5AFE" opacity="0.9" />
                      <path
                        d="M55 60 L110 40 L165 60 L140 105 L80 105 L55 60 Z M55 60 L140 105 M165 60 L80 105"
                        stroke="#3D5AFE"
                        strokeWidth="3"
                        opacity="0.45"
                      />
                    </svg>
                  )}

                  {c.illustration === "ddp" && (
                    <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
                      <rect x="45" y="35" width="130" height="70" rx="12" stroke="#6C63FF" strokeWidth="3" opacity="0.55" />
                      <path d="M70 55 H150" stroke="#6C63FF" strokeWidth="3" opacity="0.5" />
                      <path d="M70 75 H130" stroke="#6C63FF" strokeWidth="3" opacity="0.5" />
                      <path d="M70 95 H140" stroke="#6C63FF" strokeWidth="3" opacity="0.5" />
                      <rect x="62" y="108" width="96" height="16" rx="8" fill="#6C63FF" opacity="0.18" />
                      <rect x="150" y="88" width="18" height="18" rx="6" fill="#6C63FF" opacity="0.35" />
                    </svg>
                  )}

                  {c.illustration === "kalkulus" && (
                    <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
                      <path d="M70 110 V40" stroke="#FFD54F" strokeWidth="4" opacity="0.85" />
                      <path d="M70 110 H170" stroke="#FFD54F" strokeWidth="4" opacity="0.85" />
                      <path
                        d="M85 105 C100 75, 120 70, 135 55 C148 42, 160 40, 170 42"
                        stroke="#FFD54F"
                        strokeWidth="4"
                        fill="none"
                        opacity="0.85"
                      />
                      <text x="145" y="70" fontSize="18" fontWeight="800" fill="#FFD54F" opacity="0.85">
                        ∫
                      </text>
                      <text x="165" y="95" fontSize="12" fontWeight="800" fill="#FFD54F" opacity="0.85">
                        d/dx
                      </text>
                    </svg>
                  )}
                </div>

                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center w-full h-11 rounded-xl font-extrabold text-[13px]",
                    c.theme === "blue"
                      ? "bg-[#3D5AFE] text-white hover:bg-[#2F49E8]"
                      : c.theme === "purple"
                      ? "bg-[#6C63FF] text-white hover:bg-[#594FF2]"
                      : "bg-[#FFD54F] text-[#5A4F14] hover:brightness-95"
                  )}
                >
                  Enter Class
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* bottom padding */}
        <div className="h-10" />
      </div>
    </div>
  );
}