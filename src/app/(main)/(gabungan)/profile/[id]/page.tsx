"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Phone, Mail, CalendarDays, UserCircle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

type StudentProfile = {
  nama: string;
  uid: string;
  email?: string;
  telepon?: string;
  tanggalLahir?: string;
  role?: string;
  photoURL?: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function initialFromName(name: string) {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "S";
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl bg-[#F6F6F6] shadow-[0_14px_28px_rgba(0,0,0,0.08)] px-8 py-5 flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-extrabold text-[#8A7A2A]">{label}</span>
        <span className="text-[16px] font-extrabold text-[#3D3D3D]">{value}</span>
      </div>

      <div className="h-12 w-12 rounded-xl bg-transparent flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F6F8]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col items-center">
          <Skeleton className="w-[170px] h-[170px] rounded-full" />
          <Skeleton className="h-10 w-48 mt-8" />
          <Skeleton className="h-8 w-64 mt-4" />
          
          <div className="mt-10 w-full max-w-3xl space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const { id } = useParams() as { id: string };
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Format tanggal lahir
  const formatBirthDate = (dateInput: any) => {
    if (!dateInput) return "-";
    try {
      // Jika dari Firestore Timestamp
      const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      return date.toLocaleDateString("en-GB", { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return "-";
    }
  };

  // Fetch student data dari Firestore
  useEffect(() => {
    const fetchStudentProfile = async () => {
      if (!id) return;

      try {
        const userRef = doc(db, "users", id);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfile({
            nama: data.nama || "No Name",
            uid: userSnap.id,
            email: data.email || "-",
            telepon: data.telepon || "-",
            tanggalLahir: data.tanggalLahir,
            role: data.role || "-",
            photoURL: data.photoURL || null,
          });
        } else {
          console.error("Student not found");
        }
      } catch (error) {
        console.error("Error fetching student profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProfile();
  }, [id]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#F4F6F8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-600">
            Student not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col items-center justify-center w-full">
        <div className="relative w-[170px] h-[170px] rounded-full overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.10)]">
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl font-extrabold text-gray-600">
              {initialFromName(profile.nama)}
            </span>
          </div>
        </div>

        {/* Name + ID */}
        <div className="mt-8 text-center">
          <h1 className="text-[34px] font-extrabold text-[#9B8A2D] leading-tight">
            {profile.nama}
          </h1>
        </div>

        {/* Info cards */}
        <div className="mt-10 w-full max-w-3xl space-y-5 flex flex-col gap-5">
          <InfoRow
            label="No Telepon"
            value={profile.telepon || "-"}
            icon={<Phone className="h-7 w-7 text-[#5A4F14]" />}
          />
          <InfoRow
            label="E-mail Address"
            value={profile.email || "-"}
            icon={<Mail className="h-7 w-7 text-[#111111]" />}
          />
          <InfoRow
            label="Birth Date"
            value={formatBirthDate(profile.tanggalLahir)}
            icon={<CalendarDays className="h-7 w-7 text-[#111111]" />}
          />
          <InfoRow
            label="Role"
            value={profile.role || "-"}
            icon={<UserCircle className="h-7 w-7 text-[#111111]" />}
          />
        </div>
      </div>
    </div>
  );
}