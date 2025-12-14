// src/app/(main)/(murid)/components/AssignmentCard.tsx
"use client";

import { Assignment } from "@/lib/services/assignmentService";
import { cn } from "@/lib/utils";

interface AssignmentCardProps {
  assignment: Assignment;
  variant: 'ongoing' | 'submitted' | 'graded';
}

export function AssignmentCard({ assignment, variant }: AssignmentCardProps) {
  
  // Format tanggal sesuai desain: "09 Nov 2025 - 09:30"
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} ${year} - ${hours}:${minutes}`;
  };

  // Calculate time remaining dengan format "7 days 13 hours left"
  const getTimeRemaining = () => {
    if (!assignment.dueDate) return "";
    const now = new Date();
    const deadline = new Date(assignment.dueDate);
    const diff = deadline.getTime() - now.getTime();
    
    if (diff < 0) return "Overdue";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} days ${hours} hours left`;
    }
    if (hours > 0) {
      return `${hours} hours left`;
    }
    return "Less than 1 hour left";
  };

  return (
    <div 
      className="bg-white rounded-xl px-6 py-5 shadow-sm hover:shadow-md transition-all cursor-pointer group border border-gray-100"
      onClick={() => {
        // TODO: Navigate to assignment detail page
        console.log("Navigate to assignment:", assignment.id);
      }}
    >
      <div className="flex items-start justify-between gap-4">
        
        {/* LEFT SIDE - Assignment Info */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-bold text-base text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {assignment.title}
          </h3>
          
          {/* Metadata */}
          <p className="text-xs text-gray-500 mb-3">
            By {assignment.chapterName}<br />
            Published on {formatDate(assignment.createdAt)}
          </p>
          
          {/* Time/Status Info */}
          <div className="text-xs">
            {variant === 'ongoing' && (
              <span className="text-blue-600 font-semibold">
                {getTimeRemaining()}
              </span>
            )}
            
            {variant === 'submitted' && (
              <span className="text-blue-600 font-semibold">
                Submitted on {formatDate(assignment.submissionData?.submittedAt || "")}
              </span>
            )}
            
            {variant === 'graded' && (
              <span className="text-blue-600 font-semibold">
                Submitted on {formatDate(assignment.submissionData?.submittedAt || "")}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - Score Badge (Graded Only) */}
        {variant === 'graded' && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            {/* Score Number */}
            <div className="text-center">
              <div className={cn(
                "text-4xl font-bold",
                (assignment.submissionData?.score || 0) >= 75 ? "text-blue-600" : "text-red-500"
              )}>
                {assignment.submissionData?.score || 0}
              </div>
              <div className="text-xs text-gray-400 font-medium">
                Score
              </div>
            </div>
            
            {/* Rating Badge */}
            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}