"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Send, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Language = "english" | "spanish" | "arabic";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const activeRecordingTurnRef = useRef<{
    turnId: string;
    question: string;
    mode: Mode;
    questionIndex: number;
  } | null>(null);
  const sessionId = useRef<string>("");
  const userIdRef = useRef<string>("");
  const resumeIdRef = useRef<string>("");
  const answerRef = useRef("");

  const [language, setLanguage] = useState<Language>("english");
  const languageRef = useRef<Language>("english");

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  const [technicalQs, setTechnicalQs] = useState<string[]>([]);
  const [behavioralQs, setBehavioralQs] = useState<string[]>([]);

  const [mode, setMode] = useState<Mode>("technical");
  const [techIndex, setTechIndex] = useState(0);
  const [behavIndex, setBehavIndex] = useState(0);
  const [followup, setFollowup] = useState<string | null>(null);
  const [inFollowup, setInFollowup] = useState(false);

  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [recordingUploadStatus, setRecordingUploadStatus] = useState<"idle" | "uploading" | "saved" | "failed">("idle");

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const getQuestionIndex = useCallback(
    () => (mode === "technical" ? techIndex : behavIndex),
    [behavIndex, mode, techIndex]
  );

  const getTurnId = useCallback(
    (suffix = inFollowup ? "followup" : "main") =>
      `${sessionId.current}_${mode}_${getQuestionIndex()}_${suffix}`,
    [getQuestionIndex, inFollowup, mode]
  );

  const uploadAnswerRecording = useCallback(async (blob: Blob, turnMeta: NonNullable<typeof activeRecordingTurnRef.current>) => {
    if (!blob.size) return;

    setRecordingUploadStatus("uploading");

    const formData = new FormData();
    formData.append("file", blob, `answer-${turnMeta.turnId}.webm`);
    formData.append("session_id", sessionId.current);
    formData.append("kind", "answer");
    formData.append("turn_id", turnMeta.turnId);
    formData.append("question", turnMeta.question);
    formData.append("mode", turnMeta.mode);
    formData.append("question_index", String(turnMeta.questionIndex));
    formData.append("text", answerRef.current);
    if (userIdRef.current) formData.append("user_id", userIdRef.current);
    if (resumeIdRef.current) formData.append("resume_id", resumeIdRef.current);

    try {
      const res = await fetch("/api/interview/recording", {
        method: "POST",
        body: formData,
      });
      setRecordingUploadStatus(res.ok ? "saved" : "failed");
    } catch {
      setRecordingUploadStatus("failed");
    }
  }, []);

  const playAudio = useCallback((b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.onended = () => setIsSpeaking(false);
    audioRef.current.play().catch(() => setIsSpeaking(false));
  }, []);

  const speak = useCallback(
    async (
      text: string,
      options: { persist?: boolean; turnId?: string; kind?: "question" | "followup_question" } = {}
    ) => {
      if (!text) return;
      setIsSpeaking(true);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: languageRef.current,
            session_id: sessionId.current,
            user_id: userIdRef.current,
            resume_id: resumeIdRef.current,
            turn_id: options.turnId,
            kind: options.kind || "question",
            persist: Boolean(options.persist),
          }),
        });

        if (res.ok) {
          const { audio_base64 } = await res.json();
          if (audio_base64) {
            playAudio(audio_base64);
            return;
          }
        }
      } catch {
        // Non-blocking.
      }

      setIsSpeaking(false);
    },
    [playAudio]
  );

  const questions = mode === "technical" ? technicalQs : behavioralQs;
  const index = mode === "technical" ? techIndex : behavIndex;
  const setIndex = mode === "technical" ? setTechIndex : setBehavIndex;
  const currentQuestion = questions[index] ?? null;
  const isDone = phase === "interviewing" && index >= questions.length && !inFollowup;

  const startRecording = useCallback(async () => {
    if (!recordingConsent) {
      alert("Please confirm recording consent before recording an answer.");
      return;
    }

    const question = inFollowup && followup ? followup : currentQuestion;
    if (!question) return;

    activeRecordingTurnRef.current = {
      turnId: getTurnId(),
      question,
      mode,
      questionIndex: getQuestionIndex(),
    };
    recordingChunksRef.current = [];
    setRecordingUploadStatus("idle");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = mediaStream;
      const recorder = new MediaRecorder(mediaStream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const turnMeta = activeRecordingTurnRef.current;
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        if (turnMeta) {
          void uploadAnswerRecording(blob, turnMeta);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch {
      alert("Microphone access failed. Check browser permissions and try again.");
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition is not supported in this browser, but your audio is still being recorded.");
      setIsRecording(true);
      return;
    }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang =
      languageRef.current === "spanish" ? "es-ES" :
      languageRef.current === "arabic"  ? "ar-SA" : "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join("");
      setAnswer(transcript);
    };
    rec.onerror = () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    };
    rec.onend = () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    };

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }, [
    currentQuestion,
    followup,
    getQuestionIndex,
    getTurnId,
    inFollowup,
    mode,
    recordingConsent,
    uploadAnswerRecording,
  ]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!sessionId.current) {
      sessionId.current = `session_${Date.now()}`;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      userIdRef.current = user.id;

      const rawChunks = localStorage.getItem("interview_chunks");
      const resumeId = localStorage.getItem("interview_resume_id") || "";
      resumeIdRef.current = resumeId;
      const savedLanguage = localStorage.getItem("interview_language");
      const lang: Language =
        savedLanguage === "spanish" || savedLanguage === "arabic" ? savedLanguage : "english";
      languageRef.current = lang;
      setLanguage(lang);

      if (!rawChunks) {
        setError("No resume found. Please upload your resume first.");
        return;
      }

      const chunks = JSON.parse(rawChunks);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      fetch(`${apiUrl}/interview/init-session?session_id=${sessionId.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks,
          user_id: user.id,
          resume_id: resumeId,
          language: lang,
        }),
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
      const behavioralStrings: string[] = behavioral_questions.map(
        (q: { question: string }) => q.question
      );

      setTechnicalQs(technical_questions);
      setBehavioralQs(behavioralStrings);
      setPhase("interviewing");
    };

    init();
  }, [router, speak]);

  useEffect(() => {
    if (phase !== "interviewing") return;
    const question = inFollowup ? followup : currentQuestion;
    if (question) {
      speak(question, {
        persist: true,
        turnId: getTurnId(),
        kind: inFollowup ? "followup_question" : "question",
      });
    }
  }, [techIndex, behavIndex, mode, inFollowup, followup, phase, currentQuestion, speak, getTurnId]);

  const advance = useCallback(() => {
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");
    setIndex((current) => current + 1);
  }, [setIndex]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");
  };

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting || !currentQuestion) return;
    setIsSubmitting(true);

    const question = inFollowup && followup ? followup : currentQuestion;
    const turnId = getTurnId();
    const questionIndex = getQuestionIndex();

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId.current,
          question,
          answer,
          language,
          user_id: userIdRef.current,
          resume_id: resumeIdRef.current,
          turn_id: turnId,
          mode,
          question_index: questionIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (inFollowup) {
          advance();
        } else {
          setFollowup(data.followup_question);
          setInFollowup(true);
          // useEffect handles speaking the follow-up — no double playAudio here
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

  return (
    <div className="space-y-6">
      <section className="panel-surface rounded-[32px] p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="section-label">Interview session</div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
              Practice in a focused, live-session workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Move through technical and behavioral questions with voice playback,
              optional speech-to-text, and a focused answer workspace.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              router.push("/dashboard");
            }}
            className="h-12 rounded-2xl border-border/70 bg-transparent px-5 text-foreground hover:bg-accent"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </section>

      {(phase === "loading" || phase === "generating") && (
        <Card className="panel-surface rounded-[32px]">
          <CardContent className="space-y-5 py-16 text-center">
            {error ? (
              <>
                <p className="text-lg font-medium text-red-200">{error}</p>
                <Button
                  className="h-12 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={() => router.push("/setup")}
                >
                  Upload Resume
                </Button>
              </>
            ) : (
              <>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/35 border-t-primary" />
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {phase === "generating" ? "Generating your question set" : "Loading session"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {phase === "generating"
                      ? "Analyzing your resume content to create technical and behavioral prompts."
                      : "Preparing your interview environment."}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "interviewing" && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => mode !== "technical" && switchMode("technical")}
              className={`rounded-[28px] border p-5 text-left transition ${
                mode === "technical"
                  ? "border-primary/30 bg-primary/10"
                  : "border-border/70 bg-card/70 hover:bg-accent"
              }`}
            >
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Question track</p>
              <p className="mt-2 text-xl font-semibold text-foreground">Technical</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {techIndex}/{technicalQs.length} completed
              </p>
            </button>

            <button
              type="button"
              onClick={() => mode !== "behavioral" && switchMode("behavioral")}
              className={`rounded-[28px] border p-5 text-left transition ${
                mode === "behavioral"
                  ? "border-primary/30 bg-primary/10"
                  : "border-border/70 bg-card/70 hover:bg-accent"
              }`}
            >
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Question track</p>
              <p className="mt-2 text-xl font-semibold text-foreground">Behavioral</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {behavIndex}/{behavioralQs.length} completed
              </p>
            </button>
          </div>

          {isDone && (
            <Card className="panel-surface rounded-[32px]">
              <CardContent className="space-y-4 py-12 text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {mode === "technical" ? "Technical" : "Behavioral"} questions complete
                </p>
                <p className="text-muted-foreground">
                  Switch modes to continue the session or head back to the dashboard.
                </p>
                <div className="flex flex-col justify-center gap-3 md:flex-row">
                  <Button
                    className="h-12 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() =>
                      switchMode(mode === "technical" ? "behavioral" : "technical")
                    }
                  >
                    Switch to {mode === "technical" ? "Behavioral" : "Technical"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-border/70 bg-transparent px-6 text-foreground hover:bg-accent"
                    onClick={() => router.push("/dashboard")}
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isDone && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <Card className="panel-surface rounded-[32px]">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Question progress
                        </p>
                        <p className="mt-2 text-sm text-foreground/80">
                          Question {index + 1} of {questions.length}
                          {inFollowup ? " - Follow-up" : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">
                        {mode === "technical" ? "Technical" : "Behavioral"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${((index + 1) / Math.max(questions.length, 1)) * 100}%` }}
                      />
                    </div>
                  </CardHeader>
                </Card>

                <Card className="panel-surface rounded-[32px]">
                  <CardHeader className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CardTitle className="flex-1 text-2xl leading-tight text-foreground">
                        {inFollowup ? followup : currentQuestion}
                      </CardTitle>
                      {currentQuestion && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 rounded-2xl text-muted-foreground hover:bg-accent hover:text-foreground"
                          disabled={isSpeaking}
                          onClick={() => speak(inFollowup && followup ? followup : currentQuestion)}
                          title="Replay question"
                        >
                          <Volume2
                            className={`h-5 w-5 ${isSpeaking ? "animate-pulse text-primary" : ""}`}
                          />
                        </Button>
                      )}
                    </div>
                    {inFollowup && (
                      <CardDescription className="text-base text-muted-foreground">
                        Follow-up based on your previous answer.
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <textarea
                      className="min-h-[180px] w-full resize-none rounded-[24px] border border-border/70 bg-background/75 px-4 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={isRecording ? "Listening..." : "Type or record your answer..."}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                      }}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-3 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={recordingConsent}
                          onChange={(event) => setRecordingConsent(event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        Save answer audio
                      </label>

                      <Button
                        variant={isRecording ? "destructive" : "outline"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className="h-11 rounded-2xl border-border/70 bg-transparent px-4 text-foreground hover:bg-accent"
                      >
                        {isRecording ? (
                          <>
                            <MicOff className="mr-2 h-4 w-4" />
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <Mic className="mr-2 h-4 w-4" />
                            Record Answer
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={advance}
                        className="h-11 rounded-2xl px-4 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Skip
                      </Button>

                      <Button
                        onClick={handleSubmit}
                        disabled={!answer.trim() || isSubmitting}
                        className="ml-auto h-11 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Processing..." : inFollowup ? "Next Question" : "Submit"}
                      </Button>
                    </div>

                    {isRecording && (
                      <p className="text-sm text-primary">
                        Recording is active. Speak naturally and we&apos;ll save the audio with this answer.
                      </p>
                    )}
                    {recordingUploadStatus === "uploading" && (
                      <p className="text-sm text-muted-foreground">Saving answer audio...</p>
                    )}
                    {recordingUploadStatus === "saved" && (
                      <p className="text-sm text-primary">Answer audio saved.</p>
                    )}
                    {recordingUploadStatus === "failed" && (
                      <p className="text-sm text-red-200">
                        Answer text was kept, but audio upload failed. Check S3 settings.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="panel-surface rounded-[32px]">
                  <CardHeader>
                    <CardTitle className="text-foreground">Session guide</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                    <p>Technical questions are grounded in your uploaded resume content.</p>
                    <p>Behavioral questions test clarity, decision-making, and communication.</p>
                    <p>Use `Ctrl+Enter` or `Cmd+Enter` to submit quickly from the answer box.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
