import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { recordingToResponse } from "@/server/recordings/format";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const recording = await db.recording.findUnique({ where: { id } });

  if (!recording) {
    return NextResponse.json(
      { message: "녹음 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ recording: recordingToResponse(recording) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    title?: unknown;
    transcriptText?: unknown;
  };

  const data: { title?: string; transcriptText?: string } = {};

  if (typeof body.title === "string") {
    data.title = body.title.trim() || "새 녹음";
  }

  if (typeof body.transcriptText === "string") {
    data.transcriptText = body.transcriptText;
  }

  const recording = await db.recording.update({
    where: { id },
    data,
  });

  return NextResponse.json({ recording: recordingToResponse(recording) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  await db.recording.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
