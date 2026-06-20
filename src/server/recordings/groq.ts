import { env } from "@/env";

import { getAudioExtension, readAudioFile } from "./files";

const groqTranscriptionUrl =
  "https://api.groq.com/openai/v1/audio/transcriptions";

type GroqTranscriptionResponse = {
  text?: string;
  error?: {
    message?: string;
  };
};

export async function transcribeWithGroq(input: {
  audioUrl: string;
  mimeType: string;
}) {
  const apiKey = env.GROQ_API_KEY ?? env.GROQ_API_TOKEN;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }

  const audioBytes = await readAudioFile(input.audioUrl);
  const audioBlob = new Blob([new Uint8Array(audioBytes)], { type: input.mimeType });
  const formData = new FormData();

  formData.append(
    "file",
    audioBlob,
    `recording.${getAudioExtension(input.mimeType)}`,
  );
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "json");

  try {
    const response = await fetch(groqTranscriptionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const payload = (await response.json()) as GroqTranscriptionResponse;

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("업로드된 음성 파일이 너무 큽니다.");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Groq API 인증에 실패했습니다.");
      }

      if (response.status === 429) {
        throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
      }

      throw new Error(
        payload.error?.message ?? `Groq 전사 요청 실패: ${response.status}`,
      );
    }

    if (!payload.text) {
      throw new Error("Groq 응답에 전사 텍스트가 없습니다.");
    }

    return payload.text;
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error("네트워크 오류로 전사 요청에 실패했습니다.");
  }
}
