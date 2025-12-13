import { z } from "zod";

export const ROLE = ["GURU", "MURID"] as const;

export const loginSchema = z.object({
    email: z.string().email({ message: "Email tidak valid" }),
    password: z.string().min(8, "Password minimal 8 karakter"),
})
export const registerSchema = loginSchema.extend({
    nama: z.string().min(1, "Nama tidak boleh kosong"),
    tanggalLahir: z.date({
       message: "Tanggal lahir wajib diisi"
    })
    .refine((date) => {
        const today = new Date()
        const birthDate = new Date(date)

        let age = today.getFullYear() - birthDate.getFullYear()

        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
        }

        return age >= 7
    }, {
        message: "Umur minimal 7 tahun"
    }),
    role: z.enum(ROLE),
    telepon: z.string().min(1, "Nomor telepon tidak boleh kosong"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak sama",
    path: ["confirmPassword"]
})

export const tugasSchema = z.object({
    judul_tugas: z.string().min(1, "Judul tidak boleh kosong"),
    deskripsi: z.string(),
    soal: z.string().min(1, "SOAL MINIMAL 1 KARAKTER!"),
    deadline: z.date(),
})

export const assignmentSchema = z.object({
  title: z.string().min(3, "Judul tugas minimal 3 karakter"),
  instructions: z.string().optional(),
  points: z.coerce.number() // coerce biar string "100" jadi number 100
    .min(0, "Poin tidak boleh minus")
    .max(100, "Poin maksimal 100"),
  dueDate: z.string().optional().refine((val) => {
    if (!val) return true; // Boleh kosong
    return new Date(val) > new Date();
  }, "Deadline harus lebih dari waktu sekarang"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AssignmentFormValues = z.infer<typeof assignmentSchema>;