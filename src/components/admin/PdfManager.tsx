"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFormData } from "@/lib/client-upload";
import { UploadProgress } from "@/components/admin/UploadProgress";

type PdfManagerProps = {
  projectId: string;
  pdfUrl: string | null;
  onPdfChange: (pdfUrl: string | null) => void;
};

export function PdfManager({ projectId, pdfUrl, onPdfChange }: PdfManagerProps) {
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
      validatePdfFile(file);
      setUploadStatus(`Uploading ${file.name}...`);

      const formData = new FormData();
      formData.append("file", file);

      const project = await uploadFormData<{ pdfUrl: string }>(
        `/api/projects/${projectId}/pdf`,
        formData,
        setUploadProgress,
      );
      onPdfChange(project.pdfUrl);
      setMessage("PDF presentation uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed");
    } finally {
      setLoading(false);
      setUploadStatus("");
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this PDF presentation?")) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/projects/${projectId}/pdf`, { method: "DELETE" });
      if (!res.ok) throw new Error("PDF delete failed");
      onPdfChange(null);
      setMessage("PDF presentation deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF delete failed");
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

      {pdfUrl ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a href={pdfUrl} target="_blank" className="text-sm text-accent transition-colors hover:text-charcoal">
            View current PDF presentation
          </a>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="text-left text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            Delete PDF
          </button>
        </div>
      ) : (
        <p className="text-sm text-warm-gray">No PDF presentation uploaded.</p>
      )}

      {uploadStatus && <p className="text-sm text-warm-gray">{uploadStatus}</p>}
      <UploadProgress progress={uploadProgress} label={uploadStatus || "Uploading PDF"} />

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          className="hidden"
          id="pdf-upload"
        />
        <label
          htmlFor="pdf-upload"
          className={`inline-block cursor-pointer border border-dashed border-stone px-6 py-4 text-sm text-warm-gray transition-colors hover:border-accent hover:text-accent ${
            loading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {loading ? "Uploading..." : pdfUrl ? "Replace PDF" : "+ Upload PDF Presentation"}
        </label>
        <p className="mt-2 text-xs text-warm-gray">PDF only. Maximum 200MB.</p>
      </div>
    </div>
  );
}

function validatePdfFile(file: File) {
  if (file.type !== "application/pdf") {
    throw new Error("Unsupported file type. Please upload a PDF.");
  }

  if (file.size > 200 * 1024 * 1024) {
    throw new Error("PDF file size must be 200MB or less.");
  }
}
