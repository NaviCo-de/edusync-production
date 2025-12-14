"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AskLynxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (questionUrl: string, rubricUrl: string) => void;
}

export function AskLynxModal({ isOpen, onClose, onSuccess }: AskLynxModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Form States
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [totalQuestions, setTotalQuestions] = useState("10");
  const [type, setType] = useState("essay");

  const handleGenerate = async () => {
    if (!subject || !topic) return toast.error("Subject dan Topic wajib diisi!");

    setLoading(true);
    try {
      // SIMULASI REQUEST KE AI (Ganti URL ini dengan endpoint AI aslimu)
      const res = await fetch("https://lynx-ai.up.railway.app/generate/soal", {
        method: "POST",
        body: JSON.stringify({ subject, topic, difficulty, totalQuestions, type })
      });
      const data = await res.json();
      
      const mockData = {
        questionUrl: "https://res.cloudinary.com/demo/image/upload/ai_generated_question.pdf",
        rubricUrl: "https://res.cloudinary.com/demo/image/upload/ai_generated_rubric.pdf"
      };

      toast.success("✨ Magic happened! Tugas berhasil dibuat AI.");
      onSuccess(mockData.questionUrl, mockData.rubricUrl); // Kirim URL balik ke Parent
      onClose();

    } catch (error) {
      console.error(error);
      toast.error("Gagal meminta bantuan Lynx.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-600">
            <Sparkles className="w-5 h-5" />
            Ask Lynx to Create Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Input placeholder="Contoh: Matematika" value={subject} onChange={(e) => setSubject(e.target.value)} />
             </div>
             <div className="space-y-2">
                <Label>Tipe Soal</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essay">Essay</SelectItem>
                    <SelectItem value="pg">Pilihan Ganda</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="space-y-2">
            <Label>Topik Spesifik</Label>
            <Input placeholder="Contoh: Integral Tentu & Tak Tentu" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kesulitan</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
               <Label>Jumlah Soal</Label>
               <Input type="number" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : "Generate with AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}