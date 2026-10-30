import { ApiClientError } from "@/lib/client-api";
import { STORAGE_BUCKET } from "@/lib/config";

/**
 * Upload a file straight to the private Supabase Storage bucket from the browser.
 * We use XMLHttpRequest (not fetch) because it reports REAL upload progress.
 * The user's own access token is sent, so the storage policies decide what is allowed.
 */
export function uploadToStorage(args: {
  storagePath: string;
  file: File;
  accessToken: string;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}): Promise<void> {
  const { storagePath, file, accessToken, onProgress, signal } = args;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;

  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    // Allow overwriting the same path when a failed upload is retried.
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413) {
        return reject(new ApiClientError("TOO_LARGE", "The file is larger than the storage limit."));
      }
      if (xhr.status === 401 || xhr.status === 403) {
        return reject(new ApiClientError("STORAGE_DENIED", "Upload was not allowed. Please sign in again and retry."));
      }
      reject(new ApiClientError("STORAGE_ERROR", `Upload failed (status ${xhr.status}). Please retry.`));
    };
    xhr.onerror = () => reject(new ApiClientError("NETWORK", "Network error during upload. Check your connection and retry."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });

    // Same body format the official Supabase client uses.
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}
