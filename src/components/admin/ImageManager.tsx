"use client";

import { useRef, useState } from "react";
import { AdminImagePreview } from "@/components/admin/AdminImagePreview";
import { useRouter } from "next/navigation";
import { uploadFormData } from "@/lib/client-upload";
import { UploadProgress } from "@/components/admin/UploadProgress";

type ProjectImage = {
  id: string;
  url: string;
  originalUrl: string | null;
  webUrl: string | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  alt: string | null;
  sortOrder: number;
};

type ImageManagerProps = {
  projectId: string;
  images: ProjectImage[];
  onImagesChange: (images: ProjectImage[]) => void;
};

export function ImageManager({ projectId, images, onImagesChange }: ImageManagerProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [regeneratingAlts, setRegeneratingAlts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImageIds = images.filter((image) => selectedIds.has(image.id)).map((image) => image.id);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setError("");
    setMessage("");
    setUploadStatus("");

    try {
      const uploadedImages: ProjectImage[] = [];
      const selectedFiles = Array.from(files);

      for (const [index, file] of selectedFiles.entries()) {
        validateImageFile(file);
        setUploadStatus(`Uploading ${index + 1} of ${selectedFiles.length}: ${file.name}`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);

        const image = await uploadFormData<ProjectImage>("/api/upload", formData, (fileProgress) => {
          const overallProgress = Math.round(((index + fileProgress / 100) / selectedFiles.length) * 100);
          setUploadProgress(overallProgress);
        });
        uploadedImages.push(image);
        onImagesChange([...images, ...uploadedImages]);
      }

      setMessage(`${uploadedImages.length} image${uploadedImages.length === 1 ? "" : "s"} uploaded.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadStatus("");
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: string) {
    if (!confirm("Delete this image?")) return;

    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete image");
      onImagesChange(images.filter((img) => img.id !== imageId));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(imageId);
        return next;
      });
      setMessage("Image deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const reordered = [...images];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];

    const updates = reordered.map((img, i) => ({ id: img.id, sortOrder: i }));

    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/images/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) throw new Error("Failed to reorder");
      onImagesChange(reordered.map((img, i) => ({ ...img, sortOrder: i })));
      setMessage("Image order updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  function toggleSelection(imageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedImageIds.length === 0) return;
    if (!confirm("Are you sure you want to delete selected images?")) return;

    setDeletingSelected(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/images/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedImageIds }),
      });
      const data = await res.json().catch(() => null) as { error?: string; count?: number } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete selected images");

      const deletedIds = new Set(selectedImageIds);
      onImagesChange(images.filter((image) => !deletedIds.has(image.id)));
      setSelectedIds(new Set());
      const deletedCount = data?.count ?? selectedImageIds.length;
      setMessage(`${deletedCount} selected image${deletedCount === 1 ? "" : "s"} deleted.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected images");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function regenerateAltTexts() {
    setRegeneratingAlts(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${projectId}/image-alts`, { method: "PUT" });
      const data = await res.json().catch(() => null) as { error?: string; images?: ProjectImage[]; count?: number } | null;
      if (!res.ok || !data?.images) throw new Error(data?.error ?? "Failed to regenerate image alt texts");
      onImagesChange(data.images);
      setMessage(`Regenerated alt texts for ${data.count ?? data.images.length} image${data.images.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate image alt texts");
    } finally {
      setRegeneratingAlts(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border border-stone/60 bg-white px-4 py-3">
          <button
            type="button"
            onClick={regenerateAltTexts}
            disabled={regeneratingAlts || deletingSelected}
            className="mr-2 border border-stone px-3 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {regeneratingAlts ? "Regenerating..." : "Regenerate Image Alt Texts"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(images.map((image) => image.id)))}
            disabled={deletingSelected || selectedImageIds.length === images.length}
            className="text-sm text-accent transition-colors hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={deletingSelected || selectedImageIds.length === 0}
            className="text-sm text-warm-gray transition-colors hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear Selection
          </button>
          <span className="text-sm text-warm-gray">
            {selectedImageIds.length} image{selectedImageIds.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deletingSelected || selectedImageIds.length === 0}
            className="ml-auto bg-red-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletingSelected ? "Deleting..." : "Delete Selected"}
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`group relative border bg-stone/20 ${selectedIds.has(image.id) ? "border-accent ring-2 ring-accent/30" : "border-stone"}`}
          >
            <div className="relative aspect-[4/3]">
              <AdminImagePreview image={image} alt={image.alt ?? "Project image"} />
              <label className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-2 bg-white/95 px-3 py-2 text-xs font-medium text-charcoal shadow-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.has(image.id)}
                  onChange={() => toggleSelection(image.id)}
                  disabled={deletingSelected}
                  className="h-4 w-4 accent-accent"
                  aria-label={`Select image ${index + 1}`}
                />
                Select
              </label>
            </div>
            <div className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <span className="text-xs text-warm-gray">#{index + 1}</span>
                <p className="truncate text-[0.68rem] text-warm-gray">
                  {image.fileSize ? formatFileSize(image.fileSize) : "Seed image"}
                  {image.width && image.height ? ` - ${image.width} x ${image.height}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleMove(index, "up")}
                  disabled={deletingSelected || index === 0}
                  className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal disabled:opacity-30"
                  aria-label="Move up"
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, "down")}
                  disabled={deletingSelected || index === images.length - 1}
                  className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal disabled:opacity-30"
                  aria-label="Move down"
                >
                  &darr;
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  disabled={deletingSelected}
                  className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
                  aria-label="Delete image"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {uploadStatus && <p className="text-sm text-warm-gray">{uploadStatus}</p>}
      <UploadProgress progress={uploadProgress} label={uploadStatus || "Uploading images"} />

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className={`inline-block cursor-pointer border border-dashed border-stone px-6 py-4 text-sm text-warm-gray transition-colors hover:border-accent hover:text-accent ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          {uploading ? "Uploading..." : "+ Upload Images"}
        </label>
        <p className="mt-2 text-xs text-warm-gray">JPG, JPEG, PNG, or WebP. Maximum 200MB each.</p>
      </div>
    </div>
  );
}

function validateImageFile(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Unsupported image type. Allowed: JPG, JPEG, PNG, WebP.");
  }

  if (file.size > 200 * 1024 * 1024) {
    throw new Error("Image file size must be 200MB or less.");
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
