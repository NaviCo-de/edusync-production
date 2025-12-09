'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { registerSchema, RegisterInput } from "@/lib/databaseValidation";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Image from "next/image";
import { CustomIcon } from "@/components/ui/CustomIcon";

export default function RegisterScreen() {
    const router = useRouter()
    const [globalError, setGlobalError] = useState("");

    const form = useForm<RegisterInput>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            nama: "",
            email: "",
            role: "MURID",
            password: "",
            confirmPassword: "",
        }
    })

    async function onSubmit (data: RegisterInput) {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                data.email,
                data.password
            )

            const user = userCredential.user;

            const baseData = {
                uid: user.uid,
                nama: data.nama,
                role: data.role,
                telepon: data.telepon,
                tanggalLahir: data.tanggalLahir,
                email: data.email,
                createdAt: new Date(),
            };

            let roleSpecificData = {};

            if (data.role === 'MURID') {
                roleSpecificData = {
                    enrolledClassIds: [],
                    assignmentGrades: {}
                };
            } else if (data.role === 'GURU') {
                roleSpecificData = {
                    createdClassIds: [],
                };
            }

            await setDoc(doc(db, "users", user.uid), {
                ...baseData,
                ...roleSpecificData
            });
            console.log("Login Berhasil")
            router.push('/login')
        } catch (e: any) {
            console.error("Firebase Error:", e)
            setGlobalError(e.message);
        }
    }

    return (
        <div className="flex justify-center items-center h-screen mt-15 mb-15">
            <div className="flex flex-col gap-10 px-21 py-21 shadow-[0_0_20px_rgba(0,0,0,0.15)] w-209">
                <div className="text-center leading-none">
                    <h1 className="text-blue-base font-bold text-h3">Create New Account</h1>
                </div>
                <Form {...form}>
                    <form
                        className="flex flex-col justify-center items-center gap-12"
                        onSubmit={form.handleSubmit(onSubmit, (errors) => {
                            console.log("GAGAL VALIDASI:", errors)
                        })}
                    >
                        <div className="flex flex-col gap-5 w-full">
                            <FormField
                                control={form.control}
                                name="nama"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                placeholder="Nama Lengkap"
                                                variant={"auth"}
                                                icon={<CustomIcon
                                                    src={"/user.png"}
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
                                name="tanggalLahir"
                                render={({ field }) => (
                                    <FormItem>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <div
                                                        className="flex justify-between items-center text-black rounded-[20px] bg-addition-blue-30 px-8 py-4 h-19 text-b6 font-bold hover:bg-addition-blue-30"
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span className="text-addition-blue-80">Pilih tanggal lahir</span>
                                                        )}
                                                        <CustomIcon
                                                            src={"/calendar.png"}
                                                            className="w-9 h-9"
                                                        />
                                                    </div>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent>
                                                <Calendar 
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date > new Date() || date < new Date("1900-01-01")
                                                    }
                                                    autoFocus
                                                    captionLayout="dropdown"
                                                    startMonth={new Date(1900, 0)}
                                                    endMonth={new Date()}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
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
                                name="telepon"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input 
                                                placeholder="No Telepon"
                                                variant={"auth"}
                                                icon={<CustomIcon
                                                    src={"/phone.png"}
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
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih peranmu disini" />
                                                </SelectTrigger>
                                            </FormControl>

                                            <SelectContent className="bg-addition-blue-30 ">
                                                <SelectItem value="GURU">Guru</SelectItem>
                                                <SelectItem value="MURID">Murid</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <div className="flex justify-center items-start gap-5">
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Password"
                                                    variant={"auth"}
                                                    icon={<CustomIcon
                                                        src={"/password.png"}
                                                        className="w-9 h-9"
                                                    />}
                                                    type="password" 
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Confirm Password"
                                                    variant={"auth"}
                                                    icon={<CustomIcon
                                                        src={"/password.png"}
                                                        className="w-9 h-9"
                                                    />}
                                                    type="password"
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        <a href="/login" className="text-sh7 text-blue-base text-right">Already have an account? <span className="font-bold hover:underline">Log in here</span></a>
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
                            {form.formState.isSubmitting ? "Sedang Mendaftar..." : "Sign Up"}
                        </Button>
                    </form>
                </Form>
            </div>
        </div>
    )
}