// src/lib/services/assignmentService.ts
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Assignment {
  id: string;
  title: string;
  instructions?: string;
  points: number;
  dueDate: string | null;
  fileUrl?: string;
  status: 'draft' | 'published';
  createdAt: string;
  
  // Metadata untuk display
  moduleId: string;
  moduleName: string;
  chapterId: string;
  chapterName: string;
  subchapterId: string;
  subchapterName: string;
  classId: string;
  
  // Status submission
  submissionStatus?: 'not_submitted' | 'submitted' | 'graded';
  submissionData?: {
    id: string;
    score: number | null;
    feedback: string | null;
    submittedAt: string;
  };
}

/**
 * Fetch semua assignments dari semua kelas yang diikuti student
 */
export async function getStudentAssignments(studentId: string, classIds: string[]): Promise<Assignment[]> {
  try {
    const allAssignments: Assignment[] = [];

    // Loop setiap kelas
    for (const classId of classIds) {
      const chaptersRef = collection(db, "classes", classId, "chapters");
      const chaptersSnap = await getDocs(chaptersRef);

      // Loop setiap chapter
      chaptersSnap.forEach((chapterDoc) => {
        const chapterData = chapterDoc.data();
        const chapterId = chapterDoc.id;

        // Loop nested structure
        chapterData.subchapters?.forEach((subchapter: any) => {
          subchapter.assignments?.forEach((assignment: any) => {
            // Hanya ambil yang published (draft tidak ditampilkan ke murid)
            if (assignment.status === "published") {
              allAssignments.push({
                id: assignment.id,
                title: assignment.title,
                instructions: assignment.instructions,
                points: assignment.points,
                dueDate: assignment.dueDate,
                fileUrl: assignment.fileUrl,
                status: assignment.status,
                createdAt: assignment.publishedAt,
                
                moduleId: chapterId,
                moduleName: chapterData.title,
                chapterId: chapterId,
                chapterName: chapterData.title,
                subchapterId: subchapter.id,
                subchapterName: subchapter.title,
                classId: classId,
                
                submissionStatus: 'not_submitted',
              });
            }
          });
        });
      });
    }

    // 🔥 MATCH DENGAN SUBMISSIONS
    const submissionsRef = collection(db, "submissions");
    const q = query(submissionsRef, where("student_id", "==", studentId));
    const submissionsSnap = await getDocs(q);

    const submissionsMap = new Map();
    submissionsSnap.forEach((doc) => {
      const data = doc.data();
      submissionsMap.set(data.assignment_id, {
        id: doc.id,
        score: data.grading?.score ?? null,
        feedback: data.grading?.analysis?.strengths ?? null,
        submittedAt: data.created_at?.toDate()?.toISOString() ?? "",
        status: data.grading?.status ?? "SUBMITTED"
      });
    });

    // Update assignment dengan submission data
    allAssignments.forEach((assignment) => {
      const submission = submissionsMap.get(assignment.id);
      if (submission) {
        assignment.submissionStatus = submission.status === "GRADED" ? "graded" : "submitted";
        assignment.submissionData = submission;
      }
    });

    return allAssignments;

  } catch (error) {
    console.error("Error fetching assignments:", error);
    return [];
  }
}

/**
 * Kategorisasi assignments
 */
export function categorizeAssignments(assignments: Assignment[]) {
  const now = new Date();

  const ongoing = assignments.filter(a => {
    if (!a.dueDate) return true; // No deadline = always ongoing
    const deadline = new Date(a.dueDate);
    return deadline > now && a.submissionStatus === 'not_submitted';
  });

  const submitted = assignments.filter(a => a.submissionStatus === 'submitted');
  
  const graded = assignments.filter(a => a.submissionStatus === 'graded');

  // Sort by deadline (ascending untuk ongoing, descending untuk lainnya)
  ongoing.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  submitted.sort((a, b) => {
    const dateA = a.submissionData?.submittedAt || "";
    const dateB = b.submissionData?.submittedAt || "";
    return dateB.localeCompare(dateA);
  });

  graded.sort((a, b) => {
    const dateA = a.submissionData?.submittedAt || "";
    const dateB = b.submissionData?.submittedAt || "";
    return dateB.localeCompare(dateA);
  });

  return { ongoing, submitted, graded };
}