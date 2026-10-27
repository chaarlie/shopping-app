import {
  importUploadSchema,
  importPartUrlSchema,
  type ImportUpload,
} from "@shop/contracts";
import { request } from "./api";
export function uploadChunks(size: number, partSize: number) {
  return Array.from({ length: Math.ceil(size / partSize) }, (_, index) => ({
    number: index + 1,
    start: index * partSize,
    end: Math.min(size, (index + 1) * partSize),
  }));
}
export function uploadDelay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function uploadCatalog(
  file: File,
  previous: string | null,
  signal: AbortSignal,
  onSession: (id: string) => void,
  onProgress: (message: string, processing: boolean) => void,
) {
  let session: ImportUpload = previous
    ? await request(`/admin/import-uploads/${previous}`, importUploadSchema, {
        signal,
      })
    : await request("/admin/import-uploads", importUploadSchema, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, size: file.size }),
        signal,
      });
  if (
    session.state === "uploading" &&
    (session.filename !== file.name || session.size !== file.size)
  ) {
    throw new Error(
      "Choose the original file to retry, or cancel this upload first.",
    );
  }
  onSession(session.id);
  const path = `/admin/import-uploads/${session.id}`;
  if (session.state === "uploading") {
    for (const part of uploadChunks(file.size, session.partSize)) {
      onProgress(
        `Uploading part ${part.number} of ${session.partCount}…`,
        false,
      );
      for (let attempt = 0; ; attempt++) {
        try {
          const { url } = await request(
            `${path}/parts/${part.number}`,
            importPartUrlSchema,
            { signal },
          );
          const response = await fetch(url, {
            method: "PUT",
            body: file.slice(part.start, part.end),
            credentials: "omit",
            signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
          });
          if (!response.ok) {
            throw new Error(
              "A file part could not be uploaded. Retry this upload.",
            );
          }
          break;
        } catch (error) {
          if (signal.aborted || attempt >= 2) {
            throw error;
          }
          await uploadDelay(signal);
        }
      }
    }
    onProgress("Confirming upload…", false);
    session = await request(`${path}/complete`, importUploadSchema, {
      method: "POST",
      signal,
    });
  }
  onProgress(
    "Preparing your review… You can leave this page and resume later.",
    true,
  );
  while (session.state === "queued" || session.state === "processing") {
    await uploadDelay(signal);
    session = await request(path, importUploadSchema, { signal });
  }
  if (session.state !== "ready" || !session.importId) {
    throw new Error(
      session.error ??
        "This upload is no longer active. Cancel it and choose the file again.",
    );
  }
  return session.importId;
}
