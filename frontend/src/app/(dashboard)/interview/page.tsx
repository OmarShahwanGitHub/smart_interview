"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Mic, MicOff, Video, ArrowLeft, Send, Volume2 } from "lucide-react";

type Language = "english" | "spanish" | "asl";
type Phase = "loading" | "generating" | "interviewing" | "done";
type Mode = "technical" | "behavioral";

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export default function InterviewPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const sessionId = useRef(`session_${Date.now()}`);

  const [language, setLanguage] = useState<Language>("english");
  const languageRef = useRef<Language>("english"); // always current, no stale closure
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camGranted, setCamGranted] = useState(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  // ── Separate question lists ─────────────────────────────────────────
  const [technicalQs, setTechnicalQs] = useState<string[]>([]);
  const [behavioralQs, setBehavioralQs] = useState<string[]>([]);

  // ── Mode & per-mode state ───────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("technical");
  const [techIndex, setTechIndex] = useState(0);
  const [behavIndex, setBehavIndex] = useState(0);
  const [followup, setFollowup] = useState<string | null>(null);
  const [inFollowup, setInFollowup] = useState(false);

  // ── Answer ──────────────────────────────────────────────────────────
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── Play base64 MP3 ─────────────────────────────────────────────────
  const playAudio = useCallback((b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.onended = () => setIsSpeaking(false);
    audioRef.current.play().catch(() => setIsSpeaking(false));
  }, []);

  // ── ElevenLabs TTS — reads languageRef so it's never stale ──────────
  const speak = useCallback(
    async (text: string) => {
      if (languageRef.current === "asl" || !text) return;
      setIsSpeaking(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: languageRef.current }),
        });
        if (res.ok) {
          const { audio_base64 } = await res.json();
          if (audio_base64) { playAudio(audio_base64); return; }
        }
      } catch { /* non-blocking */ }
      setIsSpeaking(false);
    },
    [playAudio] // no language dep — reads ref directly
  );

  // ── Voice recording (Web Speech API) ────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = languageRef.current === "spanish" ? "es-ES" : "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join("");
      setAnswer(transcript);
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // Keep ref in sync with state (covers any future language changes)
  useEffect(() => { languageRef.current = language; }, [language]);

  // ── Load chunks + generate questions ────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const rawChunks = localStorage.getItem("interview_chunks");
      const lang = (localStorage.getItem("interview_language") as Language) || "english";
      languageRef.current = lang;
      setLanguage(lang);

      if (!rawChunks) {
        setError("No resume found. Please upload your resume first.");
        return;
      }

      const chunks = JSON.parse(rawChunks);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Init RAG vector store
      fetch(`${apiUrl}/interview/init-session?session_id=${sessionId.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunks),
      }).catch(() => null);

      setPhase("generating");

      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks, language: lang }),
      });

      if (!res.ok) {
        setError("Failed to generate questions. Is the backend running?");
        setPhase("loading");
        return;
      }

      const { technical_questions, behavioral_questions } = await res.json();
      const behavStrs: string[] = behavioral_questions.map(
        (q: { question: string }) => q.question
      );

      setTechnicalQs(technical_questions);
      setBehavioralQs(behavStrs);
      setPhase("interviewing");
      // Speak first technical question
      setTimeout(() => speak(technical_questions[0]), 500);
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Speak when question changes ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "interviewing") return;
    const q = inFollowup ? followup : currentQuestion;
    if (q) speak(q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techIndex, behavIndex, mode, inFollowup, followup]);

  // ── ASL camera ──────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(ms);
      setCamGranted(true);
      if (videoRef.current) videoRef.current.srcObject = ms;
    } catch { /* denied */ }
  };

  const stopMedia = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCamGranted(false);
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const questions = mode === "technical" ? technicalQs : behavioralQs;
  const index = mode === "technical" ? techIndex : behavIndex;
  const setIndex = mode === "technical" ? setTechIndex : setBehavIndex;
  const isDone = phase === "interviewing" && index >= questions.length && !inFollowup;
  const currentQuestion = questions[index] ?? null;

  const advance = () => {
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");
    setIndex((i) => i + 1);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");
    // Speak first question of the new mode
    const qs = m === "technical" ? technicalQs : behavioralQs;
    const idx = m === "technical" ? techIndex : behavIndex;
    setTimeout(() => speak(qs[idx]), 300);
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting) return;
    setIsSubmitting(true);

    const question = inFollowup ? followup! : currentQuestion!;

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId.current,
          question,
          answer,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (inFollowup) {
          advance();
        } else {
          setFollowup(data.followup_question);
          setInFollowup(true);
          if (data.audio_base64) playAudio(data.audio_base64);
        }
      } else {
        advance();
      }
    } catch {
      advance();
    } finally {
      setAnswer("");
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => { stopMedia(); router.push("/dashboard"); }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Interview Session</h1>
            <p className="text-sm text-muted-foreground">
              {language === "asl" ? "ASL Mode" : "Voice powered by ElevenLabs · Groq RAG"}
            </p>
          </div>
        </div>

        {/* Loading / Generating */}
        {(phase === "loading" || phase === "generating") && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              {error ? (
                <>
                  <p className="text-destructive font-medium">{error}</p>
                  <Button onClick={() => router.push("/setup")}>Upload Resume</Button>
                </>
              ) : (
                <>
                  <div className="mx-auto w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    {phase === "generating"
                      ? "Groq is analyzing your resume chunks…"
                      : "Loading…"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interview UI */}
        {phase === "interviewing" && (
          <div className="space-y-4">

            {/* Mode tabs */}
            <div className="flex gap-2">
              <Button
                variant={mode === "technical" ? "default" : "outline"}
                onClick={() => mode !== "technical" && switchMode("technical")}
                className="flex-1"
              >
                Technical ({technicalQs.length})
                {techIndex > 0 && <span className="ml-2 text-xs opacity-70">{techIndex}/{technicalQs.length}</span>}
              </Button>
              <Button
                variant={mode === "behavioral" ? "default" : "outline"}
                onClick={() => mode !== "behavioral" && switchMode("behavioral")}
                className="flex-1"
              >
                Behavioral ({behavioralQs.length})
                {behavIndex > 0 && <span className="ml-2 text-xs opacity-70">{behavIndex}/{behavioralQs.length}</span>}
              </Button>
            </div>

            {/* All done for this mode */}
            {isDone && (
              <Card>
                <CardContent className="py-10 text-center space-y-3">
                  <p className="font-semibold">
                    {mode === "technical" ? "Technical" : "Behavioral"} questions complete!
                  </p>
                  <Button
                    onClick={() => switchMode(mode === "technical" ? "behavioral" : "technical")}
                  >
                    Switch to {mode === "technical" ? "Behavioral" : "Technical"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Active question */}
            {!isDone && (
              <>
                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Question {index + 1} / {questions.length}
                      {inFollowup ? " · Follow-up" : ""}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      mode === "technical" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {mode === "technical" ? "Technical (RAG)" : "Behavioral"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${((index + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* ASL camera */}
                {language === "asl" && (
                  <Card>
                    <CardContent className="p-3">
                      {!camGranted ? (
                        <Button className="w-full" onClick={startCamera}>
                          <Video className="mr-2 h-4 w-4" /> Grant Camera Access
                        </Button>
                      ) : (
                        <div className="relative aspect-video bg-black rounded-md overflow-hidden">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                          <span className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Question card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <CardTitle className="text-base font-medium leading-snug flex-1">
                        {inFollowup ? followup : currentQuestion}
                      </CardTitle>
                      {language !== "asl" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          disabled={isSpeaking}
                          onClick={() => speak(inFollowup ? followup! : currentQuestion!)}
                          title="Replay question"
                        >
                          <Volume2 className={`h-4 w-4 ${isSpeaking ? "text-primary animate-pulse" : ""}`} />
                        </Button>
                      )}
                    </div>
                    {inFollowup && (
                      <CardDescription>Follow-up on your previous answer</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Answer textarea */}
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={isRecording ? "Listening…" : "Type or record your answer…"}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                      }}
                    />

                    {/* Controls row */}
                    <div className="flex items-center gap-2">
                      {/* Voice record button */}
                      {language !== "asl" && (
                        <Button
                          variant={isRecording ? "destructive" : "outline"}
                          size="sm"
                          onClick={isRecording ? stopRecording : startRecording}
                          className="shrink-0"
                        >
                          {isRecording ? (
                            <><MicOff className="mr-1.5 h-4 w-4" />Stop</>
                          ) : (
                            <><Mic className="mr-1.5 h-4 w-4" />Record</>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={advance}
                        className="text-muted-foreground"
                      >
                        Skip
                      </Button>

                      <Button
                        className="ml-auto"
                        onClick={handleSubmit}
                        disabled={!answer.trim() || isSubmitting}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Processing…" : inFollowup ? "Next Question" : "Submit"}
                      </Button>
                    </div>

                    {isRecording && (
                      <p className="text-xs text-primary animate-pulse flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                        Recording — speak your answer
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
