import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { recordingToResponse } from "@/server/recordings/format";
import { transcribeWithGroq } from "@/server/recordings/groq";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const recording = await db.recording.findUnique({ where: { id } });

  if (!recording) {
    return NextResponse.json(
      { message: "녹음 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  await db.recording.update({
    where: { id },
    data: {
      status: "transcribing",
      errorMessage: null,
    },
  });

  try {
    const transcriptText = await transcribeWithGroq({
      audioUrl: recording.audioUrl,
      mimeType: recording.audioMimeType,
    });

    const completed = await db.recording.update({
      where: { id },
      data: {
        status: "completed",
        transcriptText,
        errorMessage: null,
      },
    });

    return NextResponse.json({ recording: recordingToResponse(completed) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "전사 중 오류가 발생했습니다.";
    const failed = await db.recording.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: message,
      },
    });

    return NextResponse.json(
      { message, recording: recordingToResponse(failed) },
      { status: 500 },
    );
  }
}
