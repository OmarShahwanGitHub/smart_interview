import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("session_id");
    const kind = formData.get("kind");

    if (!(file instanceof File) || !sessionId || !kind) {
      return NextResponse.json(
        { error: "Missing file, session_id, or kind" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/interview/recording`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to upload recording" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Recording upload failed" },
      { status: 500 }
    );
  }
}
