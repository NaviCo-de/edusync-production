import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Kita definisikan tipe data yang bersih untuk UI,
// jadi UI tidak perlu pusing mikirin format Firestore yang aneh-aneh.
export interface StudentGrade {
  id: string;
  assignment_id: string;
  question: string; // Kita pakai cuplikan soal sebagai judul jika judul tugas tidak didenormalisasi
  status: "SUBMITTED" | "GRADED";
  score: number | null;
  submitted_at: string; // Sudah diformat jadi tanggal string
  feedback_summary: string | null; // Ambil poin utama dari AI
}

export const getStudentGrades = async (studentId: string): Promise<StudentGrade[]> => {
  try {
    const submissionsRef = collection(db, "submissions");
    
    // Query: Ambil punya siswa X, urutkan dari yang terbaru
    // NOTE: Jika console error "Index required", klik link di error console Firebase untuk buat index otomatis.
    const q = query(
      submissionsRef,
      where("student_id", "==", studentId),
      orderBy("created_at", "desc")
    );

    const snapshot = await getDocs(q);
    
    const grades: StudentGrade[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Formatting tanggal dari Firestore Timestamp
      let dateStr = "-";
      if (data.created_at instanceof Timestamp) {
        dateStr = data.created_at.toDate().toLocaleDateString("id-ID", {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      }

      // Ambil feedback AI jika ada
      let feedback = null;
      if (data.grading?.analysis?.strengths) {
        feedback = data.grading.analysis.strengths; // Atau combine strength/weakness
      }

      return {
        id: doc.id,
        assignment_id: data.assignment_id,
        question: data.content?.question || "Tugas Tanpa Judul",
        status: data.grading?.status || "SUBMITTED",
        score: data.grading?.score ?? null, // Nullish coalescing
        submitted_at: dateStr,
        feedback_summary: feedback
      };
    });

    return grades;

  } catch (error) {
    console.error("Error fetching grades:", error);
    // Kembalikan array kosong agar UI tidak crash, tapi log errornya
    return [];
  }
};