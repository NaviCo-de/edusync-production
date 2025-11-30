import { z } from "zod";

export const ROLE = ["Guru", "Murid"] as const;

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
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak sama",
    path: ["confirmPassword"]
})

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;