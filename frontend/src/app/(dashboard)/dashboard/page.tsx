"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, ScanSearch, Upload, Video } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [language, setLanguage] = useState<string>("english");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUserName(user.user_metadata?.full_name ?? user.email ?? null);

      const chunks = localStorage.getItem("interview_chunks");
      const lang = localStorage.getItem("interview_language") || "english";
      setHasResume(Boolean(chunks));
      setLanguage(lang);
    });
  }, [router]);

  const languageLabel: Record<string, string> = {
    english: "English voice session",
    spanish: "Spanish voice session",
    asl: "ASL camera session",
  };

  const nextSteps = hasResume
    ? [
        {
          title: language === "asl" ? "Start ASL interview" : "Start interview",
          copy: "Launch your practice session with your current resume and language settings.",
          icon: language === "asl" ? Video : Mic,
          action: () => router.push("/interview"),
          primary: true,
        },
        {
          title: "Screen my resume",
          copy: "Run the screener to review role fit before you practice.",
          icon: ScanSearch,
          action: () => router.push("/screen"),
        },
        {
          title: "Update setup",
          copy: "Replace the resume or change the language mode powering the session.",
          icon: Upload,
          action: () => router.push("/setup"),
        },
      ]
    : [
        {
          title: "Upload your resume",
          copy: "Add a PDF so questions, screening, and practice all reflect your experience.",
          icon: Upload,
          action: () => router.push("/setup"),
          primary: true,
        },
      ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel-surface rounded-[32px] p-8">
          <div className="section-label">Dashboard</div>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            Welcome{userName ? `, ${userName}` : ""}. Your interview prep studio is ready.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Move from resume upload to screening and guided mock interviews without
            losing context or momentum.
          </p>
        </div>

        <div className="panel-soft rounded-[32px] p-6">
          <p className="text-sm font-medium text-foreground">Current setup</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resume</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {hasResume ? "Uploaded and ready" : "Not uploaded yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Language mode</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {languageLabel[language] ?? language}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`grid gap-5 ${hasResume ? "xl:grid-cols-3" : "max-w-xl"}`}>
        {nextSteps.map((item, index) => (
          <AnimatedCard
            key={item.title}
            delay={0.08 + index * 0.08}
            className={`rounded-[28px] ${item.primary ? "border-primary/20 bg-primary/10" : "panel-surface"}`}
          >
            <CardHeader className="space-y-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.primary ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary"}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">{item.title}</CardTitle>
                <CardDescription className="mt-2 text-base leading-7 text-muted-foreground">
                  {item.copy}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={item.action}
                variant={item.primary ? "default" : "outline"}
                className={`h-12 rounded-2xl px-5 text-base font-semibold ${item.primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border/70 bg-transparent text-foreground hover:bg-accent"}`}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </AnimatedCard>
        ))}
      </section>
    </div>
  );
}
