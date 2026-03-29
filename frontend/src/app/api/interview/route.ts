import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, session_id, language = "english" } = body;

    if (!question || !answer || !session_id) {
      return NextResponse.json(
        { error: "Missing required fields (question, answer, session_id)" },
        { status: 400 }
      );
    }

    // Call Python backend
    const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const response = await fetch(`${pythonApiUrl}/interview/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, session_id, language }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to process interview");
    }

    const data = await response.json();

    return NextResponse.json({
      followup_question: data.followup_question,
      audio_base64: data.audio_base64, // Base64 encoded MP3 audio from ElevenLabs
    });
  } catch (error: any) {
    console.error("Error processing interview:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process interview" },
      { status: 500 }
    );
  }
}
