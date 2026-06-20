import type { Recording } from "../../../generated/prisma";

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function createDownloadBaseName(recording: Recording) {
  const year = recording.createdAt.getFullYear();
  const month = pad2(recording.createdAt.getMonth() + 1);
  const day = pad2(recording.createdAt.getDate());
  const hours = pad2(recording.createdAt.getHours());
  const minutes = pad2(recording.createdAt.getMinutes());

  const timestamp = `${year}${month}${day}-${hours}${minutes}`;

  return `recording-${timestamp}`;
}

export function recordingToResponse(recording: Recording) {
  return {
    id: recording.id,
    title: recording.title,
    audioUrl: recording.audioUrl,
    audioMimeType: recording.audioMimeType,
    durationSec: recording.durationSec,
    durationText: formatDuration(recording.durationSec),
    status: recording.status,
    transcriptText: recording.transcriptText,
    errorMessage: recording.errorMessage,
    createdAt: recording.createdAt.toISOString(),
    updatedAt: recording.updatedAt.toISOString(),
  };
}
