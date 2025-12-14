import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  doc,
  updateDoc,
  getDoc,
  Timestamp
} from "firebase/firestore";

// --- INTERFACES ---
export interface SubmissionData {
  id?: string;
  assignmentId: string;    // Reference ke ID Assignment (Foreign Key)
  studentId: string;       // Reference ke User
  studentName: string;
  fileUrl: string;
  fileName: string;
  submittedAt: any;        // Firestore Timestamp
  status: "SUBMITTED" | "GRADED" | "LATE";
  score?: number;          // Opsional, diisi guru nanti
  feedback?: string;       // Opsional, diisi guru nanti
}

export interface SubmissionResult {
    success: boolean;
    data?: SubmissionData;
    message?: string;
}

// --- SERVICE FUNCTIONS ---

/**
 * MENGUMPULKAN TUGAS (CREATE)
 * Disimpan di root collection 'submissions'
 */
export const submitAssignment = async (
  assignmentId: string,
  user: { uid: string; nama?: string },
  file: { url: string; name: string }
): Promise<SubmissionResult> => {
  try {
    // 1. Cek apakah sudah pernah submit sebelumnya (Prevent Duplicate)
    const q = query(
        collection(db, "submissions"), 
        where("assignmentId", "==", assignmentId),
        where("studentId", "==", user.uid)
    );
    const existingDocs = await getDocs(q);

    if (!existingDocs.empty) {
        // Opsi: Bisa throw error, atau update submission yang lama
        // Di sini kita update saja biar revisi
        const oldDocId = existingDocs.docs[0].id;
        const subRef = doc(db, "submissions", oldDocId);
        
        await updateDoc(subRef, {
            fileUrl: file.url,
            fileName: file.name,
            submittedAt: serverTimestamp(),
            status: "SUBMITTED" // Reset status kalau sebelumnya sudah dinilai? Tergantung kebijakan.
        });

        return { success: true, message: "Submission updated successfully" };
    }

    // 2. Buat Submission Baru
    const newSubmission: SubmissionData = {
      assignmentId: assignmentId,
      studentId: user.uid,
      studentName: user.nama || "Siswa Tanpa Nama",
      fileUrl: file.url,
      fileName: file.name,
      status: "SUBMITTED",
      submittedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "submissions"), newSubmission);

    return { 
        success: true, 
        data: { ...newSubmission, id: docRef.id },
        message: "Assignment submitted successfully" 
    };

  } catch (error: any) {
    console.error("Error submitting assignment:", error);
    return { success: false, message: error.message };
  }
};

/**
 * MENGAMBIL SEMUA SUBMISSION SISWA TERTENTU (READ)
 * Berguna untuk halaman "My Assignments"
 * Query sangat cepat karena di root collection.
 */
export const getStudentSubmissions = async (studentId: string): Promise<SubmissionData[]> => {
    try {
        const q = query(
            collection(db, "submissions"),
            where("studentId", "==", studentId)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SubmissionData));
    } catch (error) {
        console.error("Error fetching student submissions:", error);
        return [];
    }
};

/**
 * MENGAMBIL SEMUA SUBMISSION UNTUK SATU TUGAS (READ - TEACHER VIEW)
 * Berguna untuk halaman guru saat menilai.
 */
export const getAssignmentSubmissions = async (assignmentId: string): Promise<SubmissionData[]> => {
    try {
        const q = query(
            collection(db, "submissions"),
            where("assignmentId", "==", assignmentId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SubmissionData));
    } catch (error) {
        console.error("Error fetching assignment submissions:", error);
        return [];
    }
};

/**
 * CEK STATUS SUBMISSION (HELPER)
 * Untuk mengetahui apakah user sudah submit tugas ini
 */
export const checkSubmissionStatus = async (assignmentId: string, studentId: string) => {
    try {
        const q = query(
            collection(db, "submissions"),
            where("assignmentId", "==", assignmentId),
            where("studentId", "==", studentId)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;
        
        return {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        } as SubmissionData;
    } catch (error) {
        return null;
    }
}