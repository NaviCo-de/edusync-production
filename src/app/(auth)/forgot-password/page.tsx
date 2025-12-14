'use client';

import { useState } from 'react';
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { CustomIcon } from '@/components/ui/CustomIcon';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email) {
            setError('Email wajib diisi');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess(true);
            setError('');
        } catch (err: any) {
            console.error("Reset password error:", err);
            
            if (err.code === 'auth/user-not-found') {
                setError('Email tidak terdaftar');
            } else if (err.code === 'auth/invalid-email') {
                setError('Format email tidak valid');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Terlalu banyak percobaan. Coba lagi nanti.');
            } else {
                setError('Gagal mengirim email reset. Coba lagi.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
                    {/* SUCCESS ICON */}
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                        Email Sent!
                    </h1>
                    <p className="text-gray-600 text-sm mb-6">
                        Check your inbox at<br />
                        <span className="font-bold text-blue-600">{email}</span>
                    </p>

                    <Button 
                        onClick={() => router.push('/login')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-semibold"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center h-screen bg-gray-50 relative">
            {/* BACK BUTTON */}
            <button 
                onClick={() => router.push('/login')}
                className="absolute top-8 left-8 text-gray-600 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>

            {/* MAIN CARD */}
            <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full">
                
                {/* HEADER */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-600 mb-1">
                        Confirm Your Email
                    </h1>
                    <h2 className="text-xl font-semibold text-yellow-500">
                        To Reset Password
                    </h2>
                </div>

                {/* FORM */}
                <form onSubmit={handleResetPassword} className="space-y-6">
                    {/* EMAIL INPUT */}
                    <div className="relative">
                        <Input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            placeholder="Email"
                            variant={"auth"}
                            icon={<CustomIcon 
                                src={"/email.png"}
                                className="w-9 h-9"
                            />}
                        />
                    </div>

                    {/* ERROR MESSAGE */}
                    {error && (
                        <p className="text-red-500 text-sm text-center">
                            {error}
                        </p>
                    )}

                    {/* SUBMIT BUTTON */}
                    <Button 
                        type="submit"
                        disabled={loading || !email}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-semibold text-base"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Sending...</span>
                            </div>
                        ) : (
                            "Send"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}