"use client";

import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns"; // Pastikan install date-fns

// [REVISI] Interface ini sekarang COCOK dengan Database kamu
export interface Assignment {
  id: string;
  title: string;
  description?: string;
  deadline?: string; // String ISO dari DB
  status: string;
  createdAt?: string;
  
  // Data Tambahan (Inject dari Parent)
  classId: string;
  className: string;
  teacherName?: string;
  
  // Submission Info (Opsional)
  submissionStatus?: 'ongoing' | 'submitted' | 'graded';
  score?: number;
  submittedAt?: string;
}

interface AssignmentCardProps {
  assignment: Assignment;
  variant: 'ongoing' | 'submitted' | 'graded';
}

export function AssignmentCard({ assignment, variant }: AssignmentCardProps) {
  
  // Format tanggal: "09 Nov 2025 - 09:30"
  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = parseISO(isoString);
      return format(date, "dd MMM yyyy - HH:mm");
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Hitung sisa waktu dari DEADLINE
  const getTimeRemaining = () => {
    if (!assignment.deadline) return "";
    try {
      const now = new Date();
      const deadline = parseISO(assignment.deadline);
      const diff = deadline.getTime() - now.getTime();
      
      if (diff < 0) return "Overdue";
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) return `${days} days ${hours} hours left`;
      if (hours > 0) return `${hours} hours left`;
      return "Less than 1 hour left";
    } catch (e) {
      return "";
    }
  };

  return (
    <div 
      className="bg-white rounded-xl px-6 py-5 shadow-sm hover:shadow-md transition-all cursor-pointer group border border-gray-100"
      onClick={() => {
        // Navigasi ke detail
        console.log("Navigate to:", assignment.id);
      }}
    >
      <div className="flex items-start justify-between gap-4">
        
        {/* LEFT SIDE */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-bold text-base text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {assignment.title}
          </h3>
          
          {/* Metadata: Class Name & Date */}
          <p className="text-xs text-gray-500 mb-3">
            {assignment.className} • {assignment.teacherName || "Teacher"}
            <br />
            {variant === 'ongoing' ? "Published" : "Submitted"} on {formatDate(assignment.createdAt)}
          </p>
          
          {/* Description (Preview) */}
          {assignment.description && (
             <p className="text-xs text-gray-400 line-clamp-2 mb-2 italic">
               {assignment.description}
             </p>
          )}
          
          {/* Time/Status Info */}
          <div className="text-xs">
            {variant === 'ongoing' && (
              <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-md">
                ⏳ {getTimeRemaining()}
              </span>
            )}
            
            {(variant === 'submitted' || variant === 'graded') && (
              <span className="text-green-600 font-semibold">
                ✅ Submitted on {formatDate(assignment.submittedAt)}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - Score Badge (Graded Only) */}
        {variant === 'graded' && assignment.score !== undefined && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="text-center">
              <div className={cn(
                "text-3xl font-bold",
                assignment.score >= 75 ? "text-blue-600" : "text-red-500"
              )}>
                {assignment.score}
              </div>
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Score
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}