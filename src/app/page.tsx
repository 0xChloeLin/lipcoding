"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RecordingStatus = "recorded" | "transcribing" | "completed" | "failed";

type Recording = {
  id: string;
  title: string;
  audioUrl: string;
  audioMimeType: string;
  durationSec: number;
  durationText: string;
  status: RecordingStatus;
  transcriptText: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const statusLabel: Record<RecordingStatus, string> = {
  recorded: "전사 대기",
  transcribing: "전사 중",
  completed: "전사 완료",
  failed: "전사 실패",
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function HomePage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("새 녹음");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recorderState, setRecorderState] = useState<
    "idle" | "recording" | "paused" | "uploading"
  >("idle");
  const [message, setMessage] = useState("녹음 버튼을 눌러 시작하세요.");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");

  const selectedRecording = useMemo(
    () => recordings.find((recording) => recording.id === selectedId) ?? null,
    [recordings, selectedId],
  );

  const canRecord = recorderState === "idle";
  const isRecording = recorderState === "recording";
  const isPaused = recorderState === "paused";
  const isBusy =
    recorderState === "uploading" ||
    selectedRecording?.status === "transcribing";

  useEffect(() => {
    void loadRecordings();

    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!selectedRecording) {
      setDraftTitle("");
      setDraftTranscript("");
      return;
    }

    setDraftTitle(selectedRecording.title);
    setDraftTranscript(selectedRecording.transcriptText);
  }, [selectedRecording]);

  async function loadRecordings() {
    try {
      const response = await fetch("/api/recordings");

      if (!response.ok) {
        setMessage("녹음 목록을 불러오지 못했습니다. DB 연결을 확인하세요.");
        return;
      }

      const data = (await response.json()) as { recordings: Recording[] };

      setRecordings(data.recordings);
      setSelectedId((current) => current ?? data.recordings[0]?.id ?? null);
    } catch {
      setMessage("녹음 목록을 불러오지 못했습니다. DB 연결을 확인하세요.");
    }
  }

  function updateRecording(recording: Recording) {
    setRecordings((current) => {
      const exists = current.some((item) => item.id === recording.id);
      const next = exists
        ? current.map((item) => (item.id === recording.id ? recording : item))
        : [recording, ...current];

      return next.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
    setSelectedId(recording.id);
  }

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedSec((current) => current + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setRecordingError(null);

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("이 브라우저는 음성 녹음을 지원하지 않습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopTimer();
        void uploadRecording();
      };

      setElapsedSec(0);
      setMessage("녹음 중입니다.");
      setRecorderState("recording");
      recorder.start();
      startTimer();
    } catch {
      setRecordingError("마이크 권한을 허용한 뒤 다시 시도하세요.");
      setMessage("녹음을 시작하지 못했습니다.");
      setRecorderState("idle");
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setRecorderState("paused");
    setMessage("녹음이 일시정지되었습니다.");
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    startTimer();
    setRecorderState("recording");
    setMessage("녹음 중입니다.");
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;

    setMessage("녹음을 저장하고 있습니다.");
    setRecorderState("uploading");
    mediaRecorderRef.current.stop();
  }

  async function uploadRecording() {
    const mimeType = mediaRecorderRef.current?.mimeType ?? "audio/webm";
    const audioBlob = new Blob(chunksRef.current, { type: mimeType });
    const durationSec = Math.max(1, elapsedSec);
    const formData = new FormData();

    formData.append("title", title.trim() ? title.trim() : "새 녹음");
    formData.append("durationSec", String(durationSec));
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const uploadResponse = await fetch("/api/recordings", {
        method: "POST",
        body: formData,
      });
      const uploadData = (await uploadResponse.json()) as {
        recording?: Recording;
        message?: string;
      };

      if (!uploadResponse.ok || !uploadData.recording) {
        throw new Error(uploadData.message ?? "녹음 저장에 실패했습니다.");
      }

      updateRecording(uploadData.recording);
      setMessage("녹음 저장 완료. 전사를 시작합니다.");
      await transcribeRecording(uploadData.recording.id);
      setTitle("새 녹음");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "녹음 처리에 실패했습니다.";
      setMessage(nextMessage);
      setRecordingError(nextMessage);
    } finally {
      setRecorderState("idle");
      setElapsedSec(0);
      chunksRef.current = [];
      mediaRecorderRef.current = null;
    }
  }

  async function transcribeRecording(id: string) {
    setRecordings((current) =>
      current.map((recording) =>
        recording.id === id
          ? { ...recording, status: "transcribing", errorMessage: null }
          : recording,
      ),
    );

    const response = await fetch(`/api/recordings/${id}/transcribe`, {
      method: "POST",
    });
    const data = (await response.json()) as {
      recording?: Recording;
      message?: string;
    };

    if (data.recording) {
      updateRecording(data.recording);
    }

    if (!response.ok) {
      setMessage(data.message ?? "전사에 실패했습니다.");
      return;
    }

    setMessage("전사가 완료되었습니다.");
  }

  async function saveSelectedRecording() {
    if (!selectedRecording) return;

    const response = await fetch(`/api/recordings/${selectedRecording.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draftTitle,
        transcriptText: draftTranscript,
      }),
    });
    const data = (await response.json()) as {
      recording?: Recording;
      message?: string;
    };

    if (!response.ok || !data.recording) {
      setMessage(data.message ?? "저장에 실패했습니다.");
      return;
    }

    updateRecording(data.recording);
    setMessage("수정 내용을 저장했습니다.");
  }

  async function deleteSelectedRecording() {
    if (!selectedRecording) return;

    await fetch(`/api/recordings/${selectedRecording.id}`, {
      method: "DELETE",
    });

    setRecordings((current) =>
      current.filter((recording) => recording.id !== selectedRecording.id),
    );
    setSelectedId(null);
    setMessage("녹음 기록을 삭제했습니다.");
    void loadRecordings();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#15181d]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-[#d7dbe2] pb-5">
          <p className="text-sm font-semibold text-[#006d77]">Groq 음성 전사</p>
          <h1 className="text-3xl font-semibold tracking-normal">
            음성녹음 전사 및 다운로드
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#59616f]">
            녹음한 음성을 Groq로 텍스트 변환하고 TXT 또는 Excel 파일로
            내려받습니다.
          </p>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#d7dbe2] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">새 녹음</h2>
                  <p className="mt-1 text-sm text-[#6c7480]">{message}</p>
                </div>
                <div className="rounded-md bg-[#e9f7f6] px-3 py-2 text-xl font-semibold text-[#006d77] tabular-nums">
                  {formatDuration(elapsedSec)}
                </div>
              </div>

              {recordingError ? (
                <div className="mt-3 rounded-md border border-[#ffd7c2] bg-[#fff4ed] px-3 py-2 text-sm text-[#9a3412]">
                  <p>{recordingError}</p>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="mt-2 rounded-md bg-[#c2410c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9a3412]"
                  >
                    다시 시도
                  </button>
                </div>
              ) : null}

              <label className="mt-4 block text-sm font-medium text-[#363c46]">
                제목
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={!canRecord}
                  className="mt-2 w-full rounded-md border border-[#cbd1da] bg-white px-3 py-2 text-sm transition outline-none focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/15 disabled:bg-[#eef1f5]"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!canRecord}
                  className="rounded-md bg-[#006d77] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#005e67] disabled:cursor-not-allowed disabled:bg-[#aab3bf]"
                >
                  녹음 시작
                </button>
                {isRecording ? (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="rounded-md border border-[#cbd1da] bg-white px-3 py-2 text-sm font-semibold text-[#252b33] transition hover:bg-[#f0f3f6]"
                  >
                    일시정지
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    disabled={!isPaused}
                    className="rounded-md border border-[#cbd1da] bg-white px-3 py-2 text-sm font-semibold text-[#252b33] transition hover:bg-[#f0f3f6] disabled:cursor-not-allowed disabled:text-[#aab3bf]"
                  >
                    재개
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!isRecording && !isPaused}
                  className="col-span-2 rounded-md bg-[#c2410c] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:bg-[#d4a38d]"
                >
                  녹음 종료 및 전사
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#d7dbe2] bg-white shadow-sm">
              <div className="border-b border-[#e1e5eb] p-4">
                <h2 className="text-base font-semibold">기록 목록</h2>
              </div>
              <div className="max-h-[520px] overflow-auto">
                {recordings.length === 0 ? (
                  <p className="p-4 text-sm text-[#6c7480]">
                    저장된 녹음이 없습니다.
                  </p>
                ) : (
                  recordings.map((recording) => (
                    <button
                      key={recording.id}
                      type="button"
                      onClick={() => setSelectedId(recording.id)}
                      className={`block w-full border-b border-[#eef1f5] px-4 py-3 text-left transition hover:bg-[#f6f7f9] ${
                        selectedId === recording.id
                          ? "bg-[#edf7f6]"
                          : "bg-white"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {recording.title}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#6c7480]">
                        <span>{recording.durationText}</span>
                        <span>{statusLabel[recording.status]}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-lg border border-[#d7dbe2] bg-white shadow-sm">
            {selectedRecording ? (
              <div className="flex min-h-[640px] flex-col">
                <div className="border-b border-[#e1e5eb] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="block text-sm font-medium text-[#363c46]">
                        녹음 제목
                        <input
                          value={draftTitle}
                          onChange={(event) =>
                            setDraftTitle(event.target.value)
                          }
                          className="mt-2 w-full rounded-md border border-[#cbd1da] bg-white px-3 py-2 text-base font-semibold transition outline-none focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/15"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#59616f]">
                        <span className="rounded bg-[#eef1f5] px-2 py-1">
                          {new Date(
                            selectedRecording.createdAt,
                          ).toLocaleString()}
                        </span>
                        <span className="rounded bg-[#eef1f5] px-2 py-1">
                          {selectedRecording.durationText}
                        </span>
                        <span className="rounded bg-[#e9f7f6] px-2 py-1 text-[#006d77]">
                          {statusLabel[selectedRecording.status]}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          transcribeRecording(selectedRecording.id)
                        }
                        disabled={isBusy}
                        className="rounded-md border border-[#006d77] px-3 py-2 text-sm font-semibold text-[#006d77] transition hover:bg-[#e9f7f6] disabled:cursor-not-allowed disabled:border-[#aab3bf] disabled:text-[#aab3bf]"
                      >
                        다시 전사
                      </button>
                      <button
                        type="button"
                        onClick={saveSelectedRecording}
                        className="rounded-md bg-[#006d77] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#005e67]"
                      >
                        저장
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#d7dbe2] bg-[#f8fafc] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#252b33]">
                          전사 결과 미리보기
                        </p>
                        <p className="mt-1 text-xs text-[#6c7480]">
                          녹음 종료 후 자동으로 생성된 스크립트를 바로 확인할 수
                          있습니다.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#e9f7f6] px-3 py-1 text-xs font-semibold text-[#006d77]">
                        {statusLabel[selectedRecording.status]}
                      </span>
                    </div>

                    {selectedRecording.status === "transcribing" ? (
                      <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-[#6c7480]">
                        전사 중입니다. 완료되면 이 영역에 텍스트가 표시됩니다.
                      </p>
                    ) : selectedRecording.status === "failed" ? (
                      <p className="mt-3 rounded-md bg-[#fff4ed] px-3 py-2 text-sm text-[#9a3412]">
                        {selectedRecording.errorMessage ?? "전사에 실패했습니다."}
                      </p>
                    ) : selectedRecording.transcriptText ? (
                      <div className="mt-3 rounded-md bg-white px-3 py-3 text-sm leading-6 text-[#252b33] whitespace-pre-wrap">
                        {selectedRecording.transcriptText}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-[#6c7480]">
                        아직 전사된 텍스트가 없습니다.
                      </p>
                    )}
                  </div>

                  {selectedRecording.errorMessage ? (
                    <p className="mt-3 rounded-md bg-[#fff4ed] px-3 py-2 text-sm text-[#9a3412]">
                      {selectedRecording.errorMessage}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <label className="text-sm font-medium text-[#363c46]">
                    전사 내용
                    <textarea
                      value={draftTranscript}
                      onChange={(event) =>
                        setDraftTranscript(event.target.value)
                      }
                      placeholder="전사 결과가 여기에 표시됩니다."
                      className="mt-2 min-h-[360px] w-full flex-1 resize-y rounded-md border border-[#cbd1da] bg-white px-3 py-3 text-sm leading-6 transition outline-none focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/15"
                    />
                  </label>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e5eb] pt-4">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/recordings/${selectedRecording.id}/download.txt`}
                        className="rounded-md border border-[#cbd1da] px-3 py-2 text-sm font-semibold text-[#252b33] transition hover:bg-[#f0f3f6]"
                      >
                        TXT 다운로드
                      </a>
                      <a
                        href={`/api/recordings/${selectedRecording.id}/download.xlsx`}
                        className="rounded-md border border-[#cbd1da] px-3 py-2 text-sm font-semibold text-[#252b33] transition hover:bg-[#f0f3f6]"
                      >
                        Excel 다운로드
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={deleteSelectedRecording}
                      className="rounded-md px-3 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[640px] items-center justify-center p-8 text-center">
                <div>
                  <h2 className="text-lg font-semibold">
                    선택된 녹음이 없습니다.
                  </h2>
                  <p className="mt-2 text-sm text-[#6c7480]">
                    새 녹음을 만들면 전사 결과가 이 영역에 표시됩니다.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
