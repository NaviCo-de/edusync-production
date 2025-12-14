'use client';

import { useRouter } from "next/navigation";
import { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form";
import { LoginInput, loginSchema } from "@/lib/databaseValidation";
import { zodResolver } from "@hookform/resolvers/zod";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { error } from "console";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";
import { CustomIcon } from "@/components/ui/CustomIcon";

export default function LoginScreen() {
    const router = useRouter()
    const [globalError, setGlobalError] = useState('')

    const form = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: ""
        }
    })

    async function onSubmit (data: LoginInput) {
        setGlobalError("")
        try {
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user
            const myUid = user.uid

            const userDoc = await getDoc(doc(db, "users", myUid));

            if (userDoc.exists()) {
                console.log("Login Berhasil")
                if (userDoc.data().role == 'MURID') {
                    router.push('/dashboard-murid')
                } else if (userDoc.data().role == 'GURU') {
                    router.push('/dashboard-guru')
                }
            } else {
                console.error("Data user tidak ditemukan")
                
            }
        } catch (e) {
            console.error("Gagal Login:", e)
            setGlobalError("Email atau Password Salah")
        }
    }

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="flex flex-col gap-10 px-14 py-21 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
                <div className="text-center leading-none">
                    <h1 className="text-blue-base font-bold text-h2">Welcome Back</h1>
                    <h1 className="text-yellow-60 font-bold text-h3">SyncLearner!</h1>
                </div>
                <Form {...form}>
                    <form
                        className="flex flex-col justify-center items-center gap-12"
                        onSubmit={form.handleSubmit(onSubmit, (errors) => {
                            console.log("GAGAL SUBMIT:", errors)
                        })}
                    >
                        <div className="flex flex-col gap-2">
                            <FormField 
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="mb-3">
                                        <FormControl>
                                            <Input 
                                                placeholder="Email"
                                                variant={"auth"}
                                                icon={<CustomIcon 
                                                    src={"/email.png"}
                                                    className="w-9 h-9"
                                                />}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField 
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                placeholder="Password"
                                                type="password"
                                                variant={"auth"}
                                                icon={<CustomIcon 
                                                    src={"/password.png"}
                                                    className="w-9 h-9"
                                                />}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-between text-sh7 text-blue-50 font-semibold">
                                <a href="/forgot-password">Forgot Password?</a>
                                <a href="/register">Create Account</a>
                            </div>
                        </div>
                        {globalError && (
                            <p>
                                Error: {globalError}
                            </p> 
                        )}
                        <Button 
                            type="submit"
                            disabled={form.formState.isSubmitting}
                            className="rounded-[20px] px-8 py-4 text-b5 text-white font-semibold w-46 h-16 bg-blue-base"
                        >
                            {form.formState.isSubmitting ? "Sedang Login..." : "Login"}
                        </Button>
                    </form>

                </Form>
            </div>
        </div>
    )
}