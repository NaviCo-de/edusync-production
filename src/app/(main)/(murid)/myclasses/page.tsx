'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Search, FileText, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// Firebase
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

type Attachment = { name: string; url: string };
type Status = 'On Going' | 'Submitted' | 'Graded';

type Assignment = {
  id: string;
  tag: string;
  title: string;
  publishedAt: string;
  deadlineText: string;
  instructions: string;
  attachments: Attachment[];
  submissionStatusLabel: string;
  timeRemaining: string; // dipakai sebagai Finished On (kalau ada submission)
  primaryActionLabel: string;

  // internal fields (logic only)
  _status: Status;
  _classId: string;
  _assignmentId: string;
  _deadlineAt?: Date | null;
  _publishedAt?: Date | null;
  _submittedAt?: Date | null;
  _submissionId?: string | null;

  // deadline auto move
  _autoSubmitted?: boolean;
};

type ClassCard = {
  id: string;
  title: string;
  teacher: string;
  theme: 'blue' | 'purple' | 'yellow';
  imageUrl?: string | null;
};

type UserDoc = {
  uid: string;
  nama?: string;
  role?: string;
  daftarKelas?: string[];
};

type ClassDoc = {
  name?: string;
  teacherName?: string;
  imageUrl?: string;
};

type ChapterDoc = {
  title?: string;
  subchapters?: Array<{
    title?: string;
    assignments?: Array<{
      id?: string; // UUID inside array
      title?: string;
      description?: string;
      status?: string; // e.g. "published"
      createdAt?: any;
      publishedAt?: any;
      deadline?: any;
      questionFileUrl?: string;
      rubricFileUrl?: string;
    }>;
    materials?: Array<{ title?: string; fileUrl?: string }>;
  }>;
};

type SubmissionDoc = {
  assignmentId: string;
  studentId: string;
  status: string; // "SUBMITTED" / "GRADED" / dll
  fileName?: string;
  fileUrl?: string;
  submittedAt?: any;
};

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtPublished(d: Date | null): string {
  if (!d) return 'Published on -';
  return `Published on ${fmtDateTime(d)}`;
}

function fmtDeadline(d: Date | null): string {
  if (!d) return 'Deadline on -';
  return `Deadline on ${fmtDateTime(d)}`;
}

function timeRemaining(deadline: Date | null): string {
  if (!deadline) return '-';
  const now = new Date();
  const ms = deadline.getTime() - now.getTime();
  if (Number.isNaN(ms)) return '-';
  if (ms <= 0) return '0 days 0 hours 0 mins';

  const totalMins = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days} days ${hours} hours ${mins} mins`;
}

function mapThemeByIndex(i: number): 'blue' | 'purple' | 'yellow' {
  const themes: Array<'blue' | 'purple' | 'yellow'> = ['blue', 'purple', 'yellow'];
  return themes[i % themes.length];
}

function gradingStatusLabel(status: Status): string {
  if (status === 'On Going') return 'No Attempt';
  if (status === 'Submitted') return 'Not Graded';
  return 'Graded';
}

function inferStatusFromSubmission(sub: SubmissionDoc | null): Status {
  if (!sub) return 'On Going';
  const s = (sub.status || '').toUpperCase();
  if (s.includes('GRADED') || s.includes('SCORED') || s.includes('DONE')) return 'Graded';
  return 'Submitted';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function uploadToCloudinaryRaw(file: File): Promise<{ secureUrl: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME belum diset.');
  if (!uploadPreset) throw new Error('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET belum diset.');

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);
  // optional: keep original filename
  form.append('filename_override', file.name);

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    let msg = `Upload gagal (${res.status}).`;
    try {
      const j = await res.json();
      msg = j?.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const secureUrl = data?.secure_url as string | undefined;
  if (!secureUrl) throw new Error('Cloudinary tidak mengembalikan secure_url.');
  return { secureUrl };
}

export default function MyAssignmentsHardcodedPage() {
  const router = useRouter();

  const [filter, setFilter] = useState<Status>('On Going');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');

  // data from Firebase
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassCard[]>([]);

  // upload state (Add Submission)
  const [showUploader, setShowUploader] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      setLoading(true);
      setUploadErr('');
      setShowUploader(false);
      setUploadFile(null);

      try {
        if (!u) {
          setStudentName('');
          setAssignments([]);
          setClasses([]);
          setSelectedId('');
          return;
        }

        // 1) read user doc to know joined classes
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        const userData = (userSnap.exists() ? (userSnap.data() as UserDoc) : null) || null;
        const joinedClassIds = userData?.daftarKelas || [];
        setStudentName(userData?.nama || u.displayName || '');

        if (!joinedClassIds.length) {
          setAssignments([]);
          setClasses([]);
          setSelectedId('');
          return;
        }

        // 2) fetch class docs
        const classDocs = await Promise.all(
          joinedClassIds.map(async (classId) => {
            const cRef = doc(db, 'classes', classId);
            const cSnap = await getDoc(cRef);
            const cData = (cSnap.exists() ? (cSnap.data() as ClassDoc) : null) || null;
            return {
              id: classId,
              title: cData?.name || 'Untitled Class',
              teacher: cData?.teacherName || '-',
              imageUrl: cData?.imageUrl || null,
            };
          })
        );

        const classCards: ClassCard[] = classDocs.map((c, i) => ({
          id: c.id,
          title: c.title,
          teacher: c.teacher,
          imageUrl: c.imageUrl,
          theme: mapThemeByIndex(i),
        }));
        setClasses(classCards);

        // 3) traverse chapters -> subchapters[] -> assignments[]
        const flat: Array<{
          classId: string;
          className: string;
          assignmentId: string;
          title: string;
          description: string;
          publishedAt: Date | null;
          deadlineAt: Date | null;
          questionFileUrl?: string;
          rubricFileUrl?: string;
        }> = [];

        for (const c of classDocs) {
          const chaptersRef = collection(db, 'classes', c.id, 'chapters');
          const chaptersSnap = await getDocs(chaptersRef);

          chaptersSnap.forEach((ch) => {
            const chData = ch.data() as ChapterDoc;
            const subs = chData?.subchapters || [];
            subs.forEach((subchapter) => {
              const asgArr = subchapter?.assignments || [];
              asgArr.forEach((asg) => {
                const aid = asg?.id || '';
                const title = asg?.title || 'Untitled Assignment';
                if (!aid) return;

                flat.push({
                  classId: c.id,
                  className: c.title,
                  assignmentId: aid,
                  title,
                  description: asg?.description || '',
                  publishedAt: toDateSafe(asg?.publishedAt) || toDateSafe(asg?.createdAt),
                  deadlineAt: toDateSafe(asg?.deadline),
                  questionFileUrl: asg?.questionFileUrl || '',
                  rubricFileUrl: asg?.rubricFileUrl || '',
                });
              });
            });
          });
        }

        // 4) fetch submissions for these assignments (current student)
        const assignmentIds = flat.map((x) => x.assignmentId);
        const submissionByAssignmentId = new Map<string, { sub: SubmissionDoc; docId: string }>();

        // Firestore "in" supports up to 10 values; do chunking.
        for (const ids of chunk(assignmentIds, 10)) {
          const qSub = query(
            collection(db, 'submissions'),
            where('studentId', '==', u.uid),
            where('assignmentId', 'in', ids)
          );
          const subSnap = await getDocs(qSub);
          subSnap.forEach((d) => {
            submissionByAssignmentId.set(d.data().assignmentId, { sub: d.data() as SubmissionDoc, docId: d.id });
          });
        }

        // 5) build UI assignment list (sorted by nearest deadline first)
        const now = new Date();

        const vm: Assignment[] = flat
          .map((a) => {
            const hit = submissionByAssignmentId.get(a.assignmentId) || null;
            const sub = hit?.sub || null;

            let status = inferStatusFromSubmission(sub);
            const submittedAt = toDateSafe(sub?.submittedAt) || null;

            // RULE: if deadline passed AND no submission => treat as Submitted (auto), fileUrl/fileName empty.
            const isOverdue = !!(a.deadlineAt && a.deadlineAt.getTime() <= now.getTime());
            const autoSubmitted = status === 'On Going' && !sub && isOverdue;
            if (autoSubmitted) status = 'Submitted';

            const attachments: Attachment[] = [];
            if (a.questionFileUrl) attachments.push({ name: 'Soal.pdf', url: a.questionFileUrl });
            if (a.rubricFileUrl) attachments.push({ name: 'Rubrik.pdf', url: a.rubricFileUrl });

            return {
              id: a.assignmentId,
              tag: a.className,
              title: a.title,
              publishedAt: fmtPublished(a.publishedAt),
              deadlineText: fmtDeadline(a.deadlineAt),
              instructions: a.description || '-',
              attachments,
              submissionStatusLabel: gradingStatusLabel(status),
              timeRemaining:
                status === 'On Going'
                  ? timeRemaining(a.deadlineAt)
                  : submittedAt
                  ? fmtDateTime(submittedAt)
                  : '-', // auto-submitted: no finished-on
              primaryActionLabel: 'Add Submission',

              _status: status,
              _classId: a.classId,
              _assignmentId: a.assignmentId,
              _deadlineAt: a.deadlineAt,
              _publishedAt: a.publishedAt,
              _submittedAt: submittedAt,
              _submissionId: hit?.docId || null,
              _autoSubmitted: autoSubmitted,
            };
          })
          .sort((x, y) => {
            const dx = x._deadlineAt?.getTime() ?? Number.POSITIVE_INFINITY;
            const dy = y._deadlineAt?.getTime() ?? Number.POSITIVE_INFINITY;
            return dx - dy;
          });

        setAssignments(vm);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const base = assignments.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()));
    return base.filter((a) => a._status === filter);
  }, [assignments, filter, search]);

  // IMPORTANT: selected must be derived from filtered (not global assignments)
  const selected = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.find((a) => a.id === selectedId) || filtered[0];
  }, [filtered, selectedId]);

  // When filter/search changes, if no item => clear detail
  useEffect(() => {
    if (!filtered.length) {
      setSelectedId('');
      setShowUploader(false);
      setUploadFile(null);
      setUploadErr('');
      return;
    }
    if (selectedId && filtered.some((x) => x.id === selectedId)) return;
    setSelectedId(filtered[0]?.id || '');
    setShowUploader(false);
    setUploadFile(null);
    setUploadErr('');
  }, [filter, search, filtered.length]); // keep tight

  async function handleSubmitFile() {
    if (!currentUser || !selected) return;

    // only ongoing AND not overdue auto-submitted
    if (selected._status !== 'On Going') return;
    if (selected._deadlineAt && selected._deadlineAt.getTime() <= Date.now()) {
      setUploadErr('Deadline sudah lewat. Tugas otomatis masuk Submitted.');
      return;
    }

    if (!uploadFile) {
      setUploadErr('Pilih file terlebih dahulu.');
      return;
    }

    setUploading(true);
    setUploadErr('');

    try {
      // Upload to Cloudinary RAW
      const { secureUrl } = await uploadToCloudinaryRaw(uploadFile);

      await addDoc(collection(db, 'submissions'), {
        assignmentId: selected._assignmentId,
        studentId: currentUser.uid,
        studentName: studentName || currentUser.displayName || '',
        status: 'SUBMITTED',
        fileName: uploadFile.name,
        fileUrl: secureUrl,
        submittedAt: serverTimestamp(),
        classId: selected._classId,
      });

      // optimistic UI: mark as submitted
      const localSubmittedAt = new Date();
      setAssignments((prev) =>
        prev.map((a) => {
          if (a._assignmentId !== selected._assignmentId) return a;
          return {
            ...a,
            _status: 'Submitted',
            _submittedAt: localSubmittedAt,
            submissionStatusLabel: gradingStatusLabel('Submitted'),
            timeRemaining: fmtDateTime(localSubmittedAt),
          };
        })
      );

      setShowUploader(false);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      setUploadErr(e?.message || 'Gagal submit.');
    } finally {
      setUploading(false);
    }
  }

  const COLOR = {
    pageBg: 'bg-[#F8F9FC]',
    shadowSoft: 'shadow-[0_18px_40px_rgba(0,0,0,0.08)]',
    heroGrad: 'bg-gradient-to-r from-[#B8B6FF] to-[#3D5AFE]',
    olive: { active: 'bg-[#80711A]', idle: 'bg-[#B7A21F]' },
    activeRow: 'bg-[#4B67F6]',
    hoverRow: 'hover:bg-[#EEF0F6]',
  };

  const PANEL_H = 'h-[520px]';

  return (
    <div className={cn('min-h-screen', COLOR.pageBg)}>
      <main className="mx-20 pt-10 pb-16">
        {/* HERO + SEARCH */}
        <div className="flex items-center justify-between gap-10">
          <h1
            className={cn(
              'text-[54px] font-extrabold leading-none tracking-[-0.02em]',
              'text-transparent bg-clip-text',
              COLOR.heroGrad
            )}
          >
            Let&rsquo;s Back On Track!
          </h1>

          <div className="flex items-center gap-5">
            <div className={cn('relative w-[460px] h-[44px] rounded-full bg-white', COLOR.shadowSoft)}>
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
              className={cn('w-[44px] h-[44px] rounded-full bg-white flex items-center justify-center', COLOR.shadowSoft)}
            >
              <Bell className="w-[20px] h-[20px] text-[#3D5AFE]" />
            </button>
          </div>
        </div>

        {/* TITLE + FILTER */}
        <div className="mt-12 flex items-center justify-between">
          <h2 className="text-[30px] font-extrabold text-black">My Assignments</h2>

          <div className="flex items-center gap-3">
            {(['On Going', 'Submitted', 'Graded'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'h-[30px] px-5 rounded-full text-[12px] font-extrabold text-white transition',
                  filter === s
                    ? cn(COLOR.olive.active, 'shadow-[0_10px_22px_rgba(128,113,26,0.35)]')
                    : cn(COLOR.olive.idle, 'hover:brightness-95')
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
          {/* LEFT LIST (fixed height) */}
          <div className={cn('bg-white overflow-hidden', COLOR.shadowSoft, PANEL_H)}>
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
                      onClick={() => {
                        setSelectedId(a.id);
                        setShowUploader(false);
                        setUploadFile(null);
                        setUploadErr('');
                      }}
                      type="button"
                      className={cn(
                        'w-full text-left px-5 py-4 transition-colors',
                        active ? COLOR.activeRow : 'bg-white',
                        !active && COLOR.hoverRow,
                        !isLast && 'border-b border-[#E6E7EA]'
                      )}
                    >
                      <div className="mb-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-3 py-1 rounded-[8px] text-[10px] font-extrabold',
                            active ? 'bg-[#DDE6FF] text-[#3D5AFE]' : 'bg-[#3D5AFE] text-white'
                          )}
                        >
                          {a.tag}
                        </span>
                      </div>

                      <div className={cn('text-[14px] font-extrabold leading-snug', active ? 'text-white' : 'text-[#2F2F2F]')}>
                        {a.title}
                      </div>

                      <div className={cn('mt-1 text-[10px] font-medium', active ? 'text-[#E8ECFF]' : 'text-[#9CA3AF]')}>
                        {a.publishedAt}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-5 text-[12px] text-[#6B7280] font-medium">Tidak ada tugas.</div>
              )}
            </div>
          </div>

          {/* RIGHT DETAIL (fixed height, scroll body if overflow) */}
          <div className={cn('bg-white', COLOR.shadowSoft, PANEL_H, 'flex flex-col')}>
            {!selected ? (
              <div className="p-10 text-[12px] text-[#6B7280] font-medium" />
            ) : (
              <>
                {/* top padding area */}
                <div className="px-10 pt-10">
                  <div className="mb-6">
                    <h3 className="text-[18px] md:text-[20px] font-extrabold text-black">{selected.title}</h3>
                    <p className="mt-1 text-[12px] text-[#6B7280] font-medium">{selected.deadlineText}</p>
                  </div>
                </div>

                {/* scrollable content */}
                <div className="flex-1 overflow-auto px-10 pb-6 pr-8">
                  <div className="text-[12px] text-[#2F2F2F] leading-relaxed whitespace-pre-line">{selected.instructions}</div>

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
                          Grading Status
                        </div>
                        <div className="border-b border-[#D1D5DB] px-4 py-3 text-[12px] font-medium text-black">
                          {selected.submissionStatusLabel}
                        </div>

                        <div className="px-4 py-3 text-[12px] font-extrabold text-black">Finished On</div>
                        <div className="px-4 py-3 text-[12px] font-medium text-black">
                          {selected._status === 'On Going' ? '-' : fmtDateTime(selected._submittedAt || null)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* uploader UI only for ongoing & before deadline */}
                  {filter === 'On Going' && selected._status === 'On Going' && showUploader && (
                    <div className="mt-6">
                      <div className="w-full border border-[#D1D5DB] p-4">
                        <div className="text-[12px] font-extrabold text-black mb-3">Add Submission</div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.zip,.rar"
                          className="text-[12px] text-black"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setUploadFile(f);
                            setUploadErr('');
                          }}
                        />

                        {uploadErr && <div className="mt-2 text-[12px] font-medium text-red-600">{uploadErr}</div>}

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={handleSubmitFile}
                            className={cn(
                              'h-[34px] rounded-[8px] px-5 text-[12px] font-bold text-white inline-flex items-center gap-3',
                              uploading ? 'bg-[#9AA8FF]' : 'bg-[#3D5AFE] hover:bg-[#2F49E8]',
                              'shadow-[0_14px_30px_rgba(61,90,254,0.25)]'
                            )}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* fixed footer button: ONLY for ongoing & before deadline */}
                <div className="px-10 pb-10 pt-2">
                  <div className="flex justify-center">
                    {filter === 'On Going' && selected._status === 'On Going' && (
                      <button
                        type="button"
                        onClick={() => {
                          // if deadline already passed, do not open uploader
                          if (selected._deadlineAt && selected._deadlineAt.getTime() <= Date.now()) {
                            setUploadErr('Deadline sudah lewat. Tugas otomatis masuk Submitted.');
                            setShowUploader(false);
                            return;
                          }
                          setShowUploader((v) => !v);
                          setUploadErr('');
                        }}
                        className={cn(
                          'h-[34px] rounded-[8px] px-5 text-[12px] font-bold text-white inline-flex items-center gap-3',
                          'bg-[#3D5AFE] hover:bg-[#2F49E8]',
                          'shadow-[0_14px_30px_rgba(61,90,254,0.25)]'
                        )}
                      >
                        <span className="w-[18px] h-[18px] rounded-full border border-white/80 flex items-center justify-center">
                          <Plus className="w-[12px] h-[12px]" />
                        </span>
                        {showUploader ? 'Close' : 'Add Submission'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MY CLASS */}
        <div className="mt-16">
          <h2 className="text-[30px] font-extrabold text-black mb-8">My Class</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
            {loading ? (
              <div className="text-[12px] text-[#6B7280] font-medium">Loading...</div>
            ) : (
              classes.map((c) => {
                const titleColor =
                  c.theme === 'blue' ? 'text-[#3D5AFE]' : c.theme === 'purple' ? 'text-[#6C63FF]' : 'text-[#B08A00]';

                const btnClass =
                  c.theme === 'blue'
                    ? 'bg-[#4B67F6] text-white hover:bg-[#3F59E8]'
                    : c.theme === 'purple'
                    ? 'bg-[#6C63FF] text-white hover:bg-[#594FF2]'
                    : 'bg-[#FFE16A] text-[#5A4F14] hover:brightness-95';

                return (
                  <div
                    key={c.id}
                    className={cn(
                      'bg-white rounded-[18px] text-center',
                      COLOR.shadowSoft,
                      'flex flex-col items-center',
                      'w-full max-w-[320px]',
                      'min-h-[350px]'
                    )}
                  >
                    <div className="w-full px-7 pt-7">
                      <div className={cn('text-[20px] font-extrabold mb-1 whitespace-pre-line', titleColor)}>{c.title}</div>
                      <div className="text-[11px] text-[#6B7280] font-semibold mb-6">{c.teacher}</div>

                      <div className="h-[150px] w-full flex items-center justify-center mb-6">
                        {c.imageUrl ? (
                          <div className="relative h-[150px] w-full">
                            {/* Use plain img to avoid next/image domain config */}
                            <img src={c.imageUrl} alt={c.title} className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
                            <circle
                              cx="55"
                              cy="60"
                              r="8"
                              fill={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              opacity="0.9"
                            />
                            <circle
                              cx="110"
                              cy="40"
                              r="8"
                              fill={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              opacity="0.9"
                            />
                            <circle
                              cx="165"
                              cy="60"
                              r="8"
                              fill={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              opacity="0.9"
                            />
                            <circle
                              cx="80"
                              cy="105"
                              r="8"
                              fill={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              opacity="0.9"
                            />
                            <circle
                              cx="140"
                              cy="105"
                              r="8"
                              fill={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              opacity="0.9"
                            />
                            <path
                              d="M55 60 L110 40 L165 60 L140 105 L80 105 L55 60 Z M55 60 L140 105 M165 60 L80 105"
                              stroke={c.theme === 'purple' ? '#6C63FF' : c.theme === 'yellow' ? '#FFD54F' : '#3D5AFE'}
                              strokeWidth="3"
                              opacity="0.45"
                            />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto w-full px-7 pb-7">
                      <button
                        type="button"
                        className={cn('w-full h-[44px] rounded-[10px] font-extrabold text-[13px]', btnClass)}
                        onClick={() => router.push(`class/${c.id}`)}
                      >
                        Enter Class
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
