import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

  const worksheet = XLSX.utils.json_to_sheet([
    {
      제목: recording.title,
      녹음일시: recording.createdAt.toISOString(),
      "녹음 길이": formatDuration(recording.durationSec),
      "전사 내용": recording.transcriptText,
    },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transcript");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${createDownloadBaseName(
        recording,
      )}.xlsx"`,
    },
  });
}
