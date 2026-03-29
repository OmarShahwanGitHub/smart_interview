"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Video } from "lucide-react";

interface ASLResponse {
  confidence: number;
  buffer: string;
  last_sign: string;
  annotated_frame: string | null;
}

export default function ASLInterviewUI() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aslIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [camGranted, setCamGranted] = useState(false);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [aslConfidence, setAslConfidence] = useState(0);
  const [aslLastSign, setAslLastSign] = useState("");

  const API_URL = "http://localhost:8000";

  // CAMERA
  useEffect(() => {
    const setup = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamGranted(true);
      }
    };

    setup();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
      if (aslIntervalRef.current) clearInterval(aslIntervalRef.current);
    };
  }, []);

  // PROCESS
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !camGranted) return;

    if (!canvasRef.current)
      canvasRef.current = document.createElement("canvas");

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 320;
    canvas.height = 240;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const frame = canvas.toDataURL("image/jpeg", 0.7);

    const res = await fetch(`${API_URL}/asl/process-frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame }),
    });

    if (res.ok) {
      const data: ASLResponse = await res.json();

      setAslConfidence(data.confidence || 0);
      setAslLastSign(data.last_sign || "");

      if (data.annotated_frame) {
        setAnnotatedFrame(
          `data:image/jpeg;base64,${data.annotated_frame}`
        );
      }
    }
  }, [camGranted]);

  useEffect(() => {
    if (camGranted) {
      aslIntervalRef.current = setInterval(processFrame, 100);
    }
    return () => {
      if (aslIntervalRef.current) clearInterval(aslIntervalRef.current);
    };
  }, [camGranted, processFrame]);

  return (
    <div className="flex h-full bg-black">
      <div className="flex-1 relative">

        {/* VIDEO / ANNOTATED SWITCH */}
        <div className="h-full flex items-center justify-center">
          {annotatedFrame ? (
            <img
              src={annotatedFrame}
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* OVERLAY */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-4 rounded-xl text-white flex justify-between">
          <div>
            <p className="text-xs">Sign</p>
            <p className="text-2xl">{aslLastSign || "—"}</p>
          </div>
          <div>
            <p className="text-xs">Confidence</p>
            <p>{(aslConfidence * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}