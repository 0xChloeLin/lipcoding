import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { recordingToResponse } from "@/server/recordings/format";
import { saveAudioFile } from "@/server/recordings/files";

export async function GET() {
  const recordings = await db.recording.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    recordings: recordings.map(recordingToResponse),
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");
  const rawTitle = formData.get("title");
  const rawDurationSec = formData.get("durationSec");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { message: "음성 파일이 필요합니다." },
      { status: 400 },
    );
  }

  const durationSec = Number(rawDurationSec);

  if (!Number.isInteger(durationSec) || durationSec < 1) {
    return NextResponse.json(
      { message: "녹음 길이가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const title =
    typeof rawTitle === "string" && rawTitle.trim()
      ? rawTitle.trim()
      : "새 녹음";
  const audioUrl = await saveAudioFile(id, audio);

  const recording = await db.recording.create({
    data: {
      id,
      title,
      audioUrl,
      audioMimeType: audio.type || "audio/webm",
      durationSec,
      status: "recorded",
    },
  });

  return NextResponse.json({ recording: recordingToResponse(recording) });
}
