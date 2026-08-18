"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadProgress } from "@/components/admin/UploadProgress";

const MAX_VIDEO_UPLOAD_SIZE = 200 * 1024 * 1024;
const VIDEO_UPLOAD_ERROR_MESSAGE = "Maximum 200MB. Supported: MP4/WebM/MOV.";
const allowedVideoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];

type VideoManagerProps = {
  projectId: string;
  videoUrl: string | null;
  onVideoChange: (videoUrl: string | null) => void;
};

type PresignedVideoUpload = {
  uploadUrl: string;
  videoUrl: string;
};

type ProjectVideoResponse = {
  videoUrl: string | null;
};

export function VideoManager({ projectId, videoUrl, onVideoChange }: VideoManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setMessage("");
    setUploadStatus("");

    try {
      validateVideoFile(file);
      setUploadStatus(`Preparing ${file.name}...`);

      const presignedUpload = await requestPresignedUpload(projectId, file);
      setUploadStatus(`Uploading ${file.name}...`);
      await uploadDirectlyToR2(presignedUpload.uploadUrl, file, setUploadProgress);

      setUploadStatus("Saving project video...");
      const project = await saveProjectVideo(projectId, presignedUpload.videoUrl);
      onVideoChange(project.videoUrl);
      setMessage("Project video uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setLoading(false);
      setUploadStatus("");
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project video?")) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/projects/${projectId}/video`, { method: "DELETE" });
      if (!res.ok) throw new Error("Video delete failed");
      onVideoChange(null);
      setMessage("Project video deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border border-stone/60 bg-white p-5">
      {error && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {videoUrl ? (
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden bg-stone/30">
            <video
              key={videoUrl}
              src={videoUrl}
              className="h-full w-full object-cover"
              controls
              playsInline
              preload="metadata"
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <a href={videoUrl} target="_blank" className="text-sm text-accent transition-colors hover:text-charcoal">
              View current project video
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="text-left text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
            >
              Delete video
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-warm-gray">No project video uploaded.</p>
      )}

      {uploadStatus && <p className="text-sm text-warm-gray">{uploadStatus}</p>}
      <UploadProgress progress={uploadProgress} label={uploadStatus || "Uploading video"} />

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mov"
          onChange={handleUpload}
          className="hidden"
          id="project-video-upload"
        />
        <label
          htmlFor="project-video-upload"
          className={`inline-block cursor-pointer border border-dashed border-stone px-6 py-4 text-sm text-warm-gray transition-colors hover:border-accent hover:text-accent ${
            loading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {loading ? "Uploading..." : videoUrl ? "Replace video" : "+ Upload project video"}
        </label>
        <p className="mt-2 text-xs text-warm-gray">MP4, WebM, or MOV. Maximum 200MB.</p>
      </div>
    </div>
  );
}

async function requestPresignedUpload(projectId: string, file: File): Promise<PresignedVideoUpload> {
  const res = await fetch(`/api/projects/${projectId}/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "presign",
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Video upload failed");
  return data as PresignedVideoUpload;
}

async function saveProjectVideo(projectId: string, videoUrl: string): Promise<ProjectVideoResponse> {
  const res = await fetch(`/api/projects/${projectId}/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", videoUrl }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Video upload failed");
  return data as ProjectVideoResponse;
}

function uploadDirectlyToR2(
  uploadUrl: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      const status = [request.status, request.statusText].filter(Boolean).join(" ") || "network error";
      const responseBody = request.responseText?.trim();
      reject(new Error(`Video upload failed (${status})${responseBody ? `: ${responseBody}` : ""}`));
    });

    request.addEventListener("error", () =>
      reject(new Error("Video upload failed due to a network or CORS error before the R2 response could be read")),
    );
    request.addEventListener("abort", () => reject(new Error("Video upload was cancelled")));
    request.send(file);
  });
}

function validateVideoFile(file: File) {
  if (!allowedVideoMimeTypes.includes(file.type)) {
    throw new Error(VIDEO_UPLOAD_ERROR_MESSAGE);
  }

  if (file.size > MAX_VIDEO_UPLOAD_SIZE) {
    throw new Error(VIDEO_UPLOAD_ERROR_MESSAGE);
  }
}
