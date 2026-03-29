"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Languages, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    const nextFile = e.target.files?.[0];
    if (!nextFile) return;

    if (nextFile.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }

    setFile(nextFile);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userId) return;

    setLoading(true);
    setError(null);

    try {
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

      localStorage.setItem("interview_chunks", JSON.stringify(chunks));
      localStorage.setItem("interview_language", language);

      await supabase
        .from("profiles")
        .update({ language_preference: language })
        .eq("user_id", userId);

      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="panel-surface rounded-[32px]">
        <CardHeader className="space-y-4">
          <div className="section-label">Setup</div>
          <CardTitle className="text-3xl text-foreground">Upload the resume that will drive your session</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
            We parse the PDF, save the chunks locally for your practice flow, and store
            your language preference so screening and interviews stay aligned.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="rounded-[28px] border border-border/60 bg-secondary/60 p-5">
              <Label htmlFor="resume" className="text-foreground">
                Resume PDF
              </Label>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="h-12 cursor-pointer rounded-2xl border-border/70 bg-background/70 text-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-primary/12 file:px-3 file:py-2 file:text-primary placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                {file && (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
                    <Upload className="h-4 w-4 text-primary" />
                    {file.name}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-secondary/60 p-5">
              <Label htmlFor="language" className="text-foreground">
                Interview language
              </Label>
              <Select
                id="language"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "english" | "spanish" | "asl")
                }
                className="mt-3 h-12 rounded-2xl border-border/70 bg-background/70 text-foreground focus-visible:ring-primary"
              >
                <option value="english">English (Voice)</option>
                <option value="spanish">Spanish (Voice)</option>
                <option value="asl">American Sign Language (Camera)</option>
              </Select>
            </div>

            {error && (
              <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                type="submit"
                className="h-12 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                disabled={!file || loading}
              >
                {loading ? "Parsing resume..." : "Continue to Dashboard"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-border/70 bg-transparent px-6 text-foreground hover:bg-accent"
                onClick={() => router.push("/dashboard")}
              >
                Cancel
              </Button>
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Sending your resume through the parsing pipeline. This usually takes a
                few seconds.
              </p>
            )}
          </CardContent>
        </form>
      </Card>

      <Card className="panel-soft rounded-[32px]">
        <CardHeader className="space-y-5">
          <CardTitle className="text-xl text-foreground">What happens next</CardTitle>
          <div className="space-y-4">
            {[
              {
                icon: FileText,
                title: "Resume parsing",
                copy: "We extract content from your PDF and save the resulting chunks for your practice session.",
              },
              {
                icon: Languages,
                title: "Language profile",
                copy: "The mode you choose here is reused by the interview flow and stored as your preference.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-border/60 bg-background/55 p-4"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-lg font-medium text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.copy}</p>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
