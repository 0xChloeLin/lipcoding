import { NextResponse } from "next/server";

import { db } from "@/server/db";
import {
  createDownloadBaseName,
  formatDuration,
} from "@/server/recordings/format";

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

  const body = [
    `제목: ${recording.title}`,
    `녹음일시: ${recording.createdAt.toISOString()}`,
    `녹음 길이: ${formatDuration(recording.durationSec)}`,
    "",
    recording.transcriptText || "전사 내용이 없습니다.",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${createDownloadBaseName(
        recording,
      )}.txt"`,
    },
  });
}
