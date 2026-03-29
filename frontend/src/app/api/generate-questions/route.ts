import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunks, language = "english" } = body;

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json(
        { error: "Missing chunks array from resume parsing" },
        { status: 400 }
      );
    }

    // Call Python backend
    const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const response = await fetch(`${pythonApiUrl}/generate-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks, language }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to generate questions");
    }

    const data = await response.json();

    return NextResponse.json({
      technical_questions: data.technical_questions,
      behavioral_questions: data.behavioral_questions,
    });
  } catch (error: any) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate questions" },
      { status: 500 }
    );
  }
}
