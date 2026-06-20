import { BlobServiceClient } from "@azure/storage-blob";

import { env } from "@/env";

const extensionByMimeType: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

export function getAudioExtension(mimeType: string) {
  return extensionByMimeType[mimeType] ?? "webm";
}

function getBlobClient(blobName: string) {
  const client = BlobServiceClient.fromConnectionString(
    env.AZURE_STORAGE_CONNECTION_STRING,
  );
  const container = client.getContainerClient(
    env.AZURE_STORAGE_CONTAINER_NAME,
  );
  return container.getBlockBlobClient(blobName);
}

export async function saveAudioFile(id: string, file: File) {
  const extension = getAudioExtension(file.type);
  const blobName = `${id}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const blobClient = getBlobClient(blobName);
  await blobClient.uploadData(bytes, {
    blobHTTPHeaders: { blobContentType: file.type },
  });

  return blobClient.url;
}

export async function readAudioFile(audioUrl: string) {
  const url = new URL(audioUrl);
  const blobName = url.pathname.split("/").pop() ?? "";
  const blobClient = getBlobClient(blobName);
  const response = await blobClient.downloadToBuffer();
  return response;
}
