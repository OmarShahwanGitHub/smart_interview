"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<"english" | "spanish" | "asl">("english");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setUserId(user.id);
    });
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userId) return;

    setLoading(true);
    setError(null);

    try {
      // Send resume to backend for parsing → chunks go into RAG vector store
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Backend could not parse the resume. Is it running?");
      }

      const { chunks } = await res.json();

      if (!chunks || chunks.length === 0) {
        throw new Error("No content extracted from your resume. Try a different PDF.");
      }

      // Store chunks in localStorage — RAG uses these, NOT Supabase
      localStorage.setItem("interview_chunks", JSON.stringify(chunks));
      localStorage.setItem("interview_language", language);

      // Supabase is auth-only — just save language preference on the profile
      await supabase
        .from("profiles")
        .update({ language_preference: language })
        .eq("user_id", userId);

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Set Up Your Interview</CardTitle>
          <CardDescription>
            Upload your resume — we'll extract it into our RAG system to generate
            personalized questions.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="resume">Resume (PDF)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {file && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Upload className="h-4 w-4" />
                    {file.name}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Interview Language</Label>
              <Select
                id="language"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "english" | "spanish" | "asl")
                }
              >
                <option value="english">English (Voice)</option>
                <option value="spanish">Spanish (Voice)</option>
                <option value="asl">American Sign Language (Camera)</option>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={!file || loading}>
              {loading ? "Parsing resume…" : "Continue to Dashboard"}
            </Button>

            {loading && (
              <p className="text-xs text-center text-muted-foreground">
                Sending resume to RAG backend — this takes a few seconds…
              </p>
            )}
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
