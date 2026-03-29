"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Send, Video, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const syncedAslTextRef = useRef("");
  const sessionId = useRef<string>("");
  const aslSessionId = useRef<string>("");
  const aslIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [language, setLanguage] = useState<Language>("english");
  const languageRef = useRef<Language>("english");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camGranted, setCamGranted] = useState(false);

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

  const [aslText, setAslText] = useState("");
  const [aslConfidence, setAslConfidence] = useState(0);
  const [aslLastSign, setAslLastSign] = useState("");
  const [isAslProcessing, setIsAslProcessing] = useState(false);

  const playAudio = useCallback((b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.onended = () => setIsSpeaking(false);
    audioRef.current.play().catch(() => setIsSpeaking(false));
  }, []);

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

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

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

  const startAslProcessing = useCallback(async () => {
    if (!videoRef.current || !camGranted) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/asl/reset?session_id=${aslSessionId.current}`, {
        method: "POST",
      });
    } catch {
      // Non-blocking.
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 320;
    canvas.height = 240;

    const processFrame = async () => {
      if (!videoRef.current) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL("image/jpeg", 0.8);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/asl/process-frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: aslSessionId.current,
            frame: frameData,
            width: canvas.width,
            height: canvas.height,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAslText(data.buffer || "");
          setAslConfidence(data.confidence || 0);
          setAslLastSign(data.last_sign || "");
        }
      } catch {
        // Non-blocking.
      }
    };

    aslIntervalRef.current = setInterval(processFrame, 100);
    setIsAslProcessing(true);
  }, [camGranted]);

  const stopAslProcessing = useCallback(() => {
    if (aslIntervalRef.current) {
      clearInterval(aslIntervalRef.current);
      aslIntervalRef.current = null;
    }
    setIsAslProcessing(false);
  }, []);

  const resetAslBuffer = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/asl/reset?session_id=${aslSessionId.current}`, {
        method: "POST",
      });
      setAslText("");
      setAslLastSign("");
      setAslConfidence(0);
    } catch {
      // Non-blocking.
    }
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!sessionId.current) {
      sessionId.current = `session_${Date.now()}`;
    }
    if (!aslSessionId.current) {
      aslSessionId.current = `asl_${Date.now()}`;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

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
      const behavioralStrings: string[] = behavioral_questions.map(
        (q: { question: string }) => q.question
      );

      setTechnicalQs(technical_questions);
      setBehavioralQs(behavioralStrings);
      setPhase("interviewing");
      setTimeout(() => speak(technical_questions[0]), 500);
    };

    init();
  }, [router, speak]);

  const questions = mode === "technical" ? technicalQs : behavioralQs;
  const index = mode === "technical" ? techIndex : behavIndex;
  const setIndex = mode === "technical" ? setTechIndex : setBehavIndex;
  const currentQuestion = questions[index] ?? null;
  const isDone = phase === "interviewing" && index >= questions.length && !inFollowup;

  useEffect(() => {
    if (phase !== "interviewing") return;
    const question = inFollowup ? followup : currentQuestion;
    if (question) speak(question);
  }, [techIndex, behavIndex, mode, inFollowup, followup, phase, currentQuestion, speak]);

  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setStream(media);
      setCamGranted(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          videoRef.current.play().catch(() => null);
        }
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Camera access failed: ${message}`);
      setCamGranted(false);
    }
  };

  const stopMedia = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCamGranted(false);
    stopAslProcessing();
  }, [stream, stopAslProcessing]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (language === "asl" && camGranted && !isAslProcessing) {
      startAslProcessing();
    } else if ((language !== "asl" || !camGranted) && isAslProcessing) {
      stopAslProcessing();
    }
  }, [language, camGranted, isAslProcessing, startAslProcessing, stopAslProcessing]);

  useEffect(() => {
    if (language !== "asl") {
      syncedAslTextRef.current = "";
      return;
    }

    setAnswer((previousAnswer) => {
      const previousSyncedText = syncedAslTextRef.current;
      const trimmedAnswer = previousAnswer.trimEnd();

      if (previousSyncedText && trimmedAnswer.endsWith(previousSyncedText)) {
        const prefix = trimmedAnswer.slice(0, trimmedAnswer.length - previousSyncedText.length).trimEnd();
        syncedAslTextRef.current = aslText;
        return aslText ? `${prefix ? `${prefix} ` : ""}${aslText}` : prefix;
      }

      if (!previousSyncedText) {
        syncedAslTextRef.current = aslText;
        return aslText ? `${trimmedAnswer ? `${trimmedAnswer} ` : ""}${aslText}` : previousAnswer;
      }

      syncedAslTextRef.current = aslText;
      return previousAnswer;
    });
  }, [aslText, language]);

  const advance = useCallback(() => {
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");
    setAslText("");
    syncedAslTextRef.current = "";
    setIndex((current) => current + 1);
  }, [setIndex]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFollowup(null);
    setInFollowup(false);
    setAnswer("");

    const nextQuestions = nextMode === "technical" ? technicalQs : behavioralQs;
    const nextIndex = nextMode === "technical" ? techIndex : behavIndex;
    setTimeout(() => {
      if (nextQuestions[nextIndex]) speak(nextQuestions[nextIndex]);
    }, 300);
  };

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting || !currentQuestion) return;
    setIsSubmitting(true);

    const question = inFollowup && followup ? followup : currentQuestion;

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
              optional speech-to-text, and ASL camera support when needed.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              stopMedia();
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
                      {language !== "asl" && currentQuestion && (
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
                      {language !== "asl" && (
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
                      )}

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
                        Recording is active. Speak naturally and we&apos;ll fill the answer box.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {(language === "asl" || camGranted) && (
                  <Card className="panel-surface rounded-[32px]">
                    <CardHeader>
                      <CardTitle className="text-foreground">ASL Recognition</CardTitle>
                      <CardDescription className="leading-7 text-muted-foreground">
                        Sign into the camera and add recognized text into your answer when it looks right.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!camGranted ? (
                        <Button
                          className="h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                          onClick={startCamera}
                        >
                          <Video className="mr-2 h-5 w-5" />
                          Enable Camera for ASL
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative overflow-hidden rounded-[24px] border border-border/70 bg-black">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              width={640}
                              height={480}
                              className="aspect-video h-auto w-full object-cover"
                              style={{ display: "block", backgroundColor: "#000" }}
                            />
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                                  isAslProcessing
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-red-400/90 text-white"
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isAslProcessing ? "animate-pulse bg-white" : "bg-red-200"
                                  }`}
                                />
                                {isAslProcessing ? "Processing" : "Inactive"}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-[16px] border border-border/70 bg-background/75 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">Recognized Text</span>
                              <span className="text-xs text-muted-foreground">
                                Confidence: {Math.round(aslConfidence * 100)}%
                              </span>
                            </div>
                            <div className="min-h-[60px] rounded bg-secondary p-3 text-lg font-mono text-primary">
                              {aslText || <span className="text-muted-foreground">Start signing...</span>}
                            </div>
                            {aslLastSign && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                Last sign: <span className="font-medium text-primary">{aslLastSign}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetAslBuffer}
                              className="flex-1 rounded-xl border-border/70 bg-transparent text-foreground hover:bg-accent"
                            >
                              Clear Text
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Recognized ASL text now syncs into your answer box automatically.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

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
