export type UploadProgressHandler = (percentage: number) => void;

type ErrorResponse = { error?: string };

export function uploadFormData<T>(
  url: string,
  formData: FormData,
  onProgress?: UploadProgressHandler,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      const response = request.response as (T & ErrorResponse) | null;
      if (request.status >= 200 && request.status < 300 && response) {
        onProgress?.(100);
        resolve(response);
        return;
      }

      reject(new Error(response?.error ?? `Upload failed (${request.status || "network error"})`));
    });

    request.addEventListener("error", () => reject(new Error("Upload failed due to a network error")));
    request.addEventListener("abort", () => reject(new Error("Upload was cancelled")));
    request.send(formData);
  });
}
