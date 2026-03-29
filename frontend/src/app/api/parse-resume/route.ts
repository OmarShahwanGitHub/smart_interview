import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("user_id") as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: "Missing file or user_id" },
        { status: 400 }
      );
    }

    // Call Python backend
    const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await fetch(`${pythonApiUrl}/parse-resume`, {
      method: "POST",
      body: backendFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to parse resume");
    }

    const data = await response.json();

    // Return parsed fields and chunks
    return NextResponse.json({
      fields: data.fields,
      chunks: data.chunks,
    });
  } catch (error: any) {
    console.error("Error parsing resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse resume" },
      { status: 500 }
    );
  }
}
