"use client";

import { SmartImage } from "@/components/SmartImage";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { AboutSettingsView } from "@/lib/site-settings";
import { uploadFormData } from "@/lib/client-upload";
import { UploadProgress } from "@/components/admin/UploadProgress";

type AboutSettingsFormProps = {
  initialData: AboutSettingsView;
};

const textFields: Array<{
  key: keyof AboutSettingsView;
  label: string;
  textarea?: boolean;
}> = [
  { key: "eyebrowTr", label: "Eyebrow / Label (TR)" },
  { key: "eyebrowEn", label: "Eyebrow / Label (EN)" },
  { key: "titleTr", label: "About Title (TR)" },
  { key: "titleEn", label: "About Title (EN)" },
  { key: "descriptionTr", label: "Description (TR)", textarea: true },
  { key: "descriptionEn", label: "Description (EN)", textarea: true },
  { key: "approachLabelTr", label: "Approach Label (TR)" },
  { key: "approachLabelEn", label: "Approach Label (EN)" },
  { key: "approachTitleTr", label: "Approach Title (TR)" },
  { key: "approachTitleEn", label: "Approach Title (EN)" },
  { key: "materialTitleTr", label: "Quality Title (TR)" },
  { key: "materialTitleEn", label: "Quality Title (EN)" },
  { key: "materialTextTr", label: "Quality Text (TR)", textarea: true },
  { key: "materialTextEn", label: "Quality Text (EN)", textarea: true },
  { key: "proportionTitleTr", label: "Reliability Title (TR)" },
  { key: "proportionTitleEn", label: "Reliability Title (EN)" },
  { key: "proportionTextTr", label: "Reliability Text (TR)", textarea: true },
  { key: "proportionTextEn", label: "Reliability Text (EN)", textarea: true },
  { key: "narrativeTitleTr", label: "Execution Title (TR)" },
  { key: "narrativeTitleEn", label: "Execution Title (EN)" },
  { key: "narrativeTextTr", label: "Execution Text (TR)", textarea: true },
  { key: "narrativeTextEn", label: "Execution Text (EN)", textarea: true },
];

export function AboutSettingsForm({ initialData }: AboutSettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function updateTextField(key: keyof AboutSettingsView, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = Object.fromEntries(
        textFields.map((field) => [field.key, String(form[field.key] ?? "")]),
      );

      const res = await fetch("/api/about-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save about settings");
      }

      setMessage("About page saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save about settings");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    setError("");

    try {
      validateImageFile(file);
      const data = new FormData();
      data.append("file", file);

      const settings = await uploadFormData<AboutSettingsView>(
        "/api/about-settings/image",
        data,
        setUploadProgress,
      );
      setForm((prev) => ({
        ...prev,
        imageUrl: settings.imageWebUrl ?? settings.imageUrl ?? null,
        imageOriginalUrl: settings.imageOriginalUrl ?? null,
        imageWebUrl: settings.imageWebUrl ?? null,
        imageThumbnailUrl: settings.imageThumbnailUrl ?? null,
        imageFileSize: settings.imageFileSize ?? null,
        imageWidth: settings.imageWidth ?? null,
        imageHeight: settings.imageHeight ?? null,
        imageMimeType: settings.imageMimeType ?? null,
      }));
      setMessage("About image uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteImage() {
    if (!confirm("Delete the About page image?")) return;

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/about-settings/image", { method: "DELETE" });

      if (!res.ok) {
        const response = await res.json();
        throw new Error(response.error ?? "Image delete failed");
      }

      setForm((prev) => ({
        ...prev,
        imageUrl: null,
        imageOriginalUrl: null,
        imageWebUrl: null,
        imageThumbnailUrl: null,
        imageFileSize: null,
        imageWidth: null,
        imageHeight: null,
        imageMimeType: null,
      }));
      setMessage("About image deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image delete failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <section className="border border-stone/60 bg-white p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-warm-gray">About Image</h2>
            <p className="mt-2 text-sm text-warm-gray">Uploads use the same optimized local/R2-compatible image storage.</p>
            {form.imageFileSize && (
              <p className="mt-2 text-xs text-warm-gray">
                {formatFileSize(form.imageFileSize)}
                {form.imageWidth && form.imageHeight ? ` · ${form.imageWidth} × ${form.imageHeight}` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={inputRef}
              id="about-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadImage}
              className="hidden"
            />
            <label
              htmlFor="about-image"
              className={`cursor-pointer border border-stone px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] transition-colors hover:border-accent hover:text-accent ${
                uploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {uploading ? "Uploading..." : form.imageUrl ? "Replace Image" : "Upload Image"}
            </label>
            {form.imageUrl && (
              <button
                type="button"
                onClick={deleteImage}
                disabled={uploading}
                className="px-4 py-3 text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
              >
                Delete Image
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 max-w-2xl">
          <UploadProgress progress={uploadProgress} label="Uploading about image" />
        </div>

        {form.imageUrl && (
          <div className="relative mt-6 aspect-[4/3] max-w-2xl overflow-hidden bg-stone">
            <SmartImage src={form.imageUrl} alt="About page image" fill className="object-cover" sizes="720px" />
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {textFields.map((field) => {
          const value = String(form[field.key] ?? "");

          return field.textarea ? (
            <div key={field.key} className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{field.label}</label>
              <textarea
                rows={4}
                value={value}
                onChange={(e) => updateTextField(field.key, e.target.value)}
                className="w-full resize-y border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
              />
            </div>
          ) : (
            <div key={field.key}>
              <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{field.label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => updateTextField(field.key, e.target.value)}
                className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
              />
            </div>
          );
        })}
      </section>

      <div className="border-t border-stone/40 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="bg-charcoal px-8 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save About Page"}
        </button>
      </div>
    </form>
  );
}

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function validateImageFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Unsupported image type. Allowed: JPG, JPEG, PNG, WebP.");
  }
  if (file.size > 200 * 1024 * 1024) {
    throw new Error("Image file size must be 200MB or less.");
  }
}
