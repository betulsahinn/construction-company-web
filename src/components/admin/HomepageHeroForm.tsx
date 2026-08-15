"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { SmartImage } from "@/components/SmartImage";
import { useRouter } from "next/navigation";
import { BRAND_NAME } from "@/lib/i18n";
import { uploadFormData } from "@/lib/client-upload";
import { UploadProgress } from "@/components/admin/UploadProgress";

const HERO_BRAND_TITLE = "Mehmet Eser\nInterior Design Studio";
const LEGACY_HERO_TITLES = [
  "Horizon Residence",
  "Mehmet Eser",
  "Mehmet Eser\nInterior Design\nStudio",
  BRAND_NAME,
];

type HomepageHeroData = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaType: "image" | "video";
  imageUrl: string | null;
  videoUrl: string | null;
};

type HomepageHeroFormProps = {
  initialData: HomepageHeroData;
};

export function HomepageHeroForm({ initialData }: HomepageHeroFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const activeMediaType = resolveActiveMediaType(form);

  function updateField<K extends keyof HomepageHeroData>(key: K, value: HomepageHeroData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/homepage-hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || null,
          subtitle: form.subtitle || null,
          ctaLabel: form.ctaLabel || null,
          ctaUrl: form.ctaUrl || null,
          mediaType: form.mediaType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save homepage hero");
      }

      const hero = await res.json();
      setForm((prev) => ({ ...prev, ...normalizeHero(hero) }));
      setMessage("Homepage hero saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save homepage hero");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(e: React.ChangeEvent<HTMLInputElement>, mediaType: "image" | "video") {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(mediaType);
    setError("");
    setMessage("");

    try {
      validateMediaFile(file, mediaType);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", mediaType);

      const hero = await uploadFormData<HomepageHeroData>(
        "/api/homepage-hero/media",
        formData,
        setUploadProgress,
      );
      setForm((prev) => ({ ...prev, ...normalizeHero(hero) }));
      setMessage(`${mediaType === "image" ? "Image" : "Video"} uploaded.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
      setUploadProgress(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function deleteMedia(mediaType: "image" | "video") {
    if (!confirm(`Delete homepage hero ${mediaType}?`)) return;

    setUploading(mediaType);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/homepage-hero/media?mediaType=${mediaType}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }

      const hero = await res.json();
      setForm((prev) => ({ ...prev, ...normalizeHero(hero) }));
      setMessage(`${mediaType === "image" ? "Image" : "Video"} deleted.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setUploading(null);
    }
  }

  return (
    <form onSubmit={saveSettings} className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Hero Title" value={form.title} onChange={(value) => updateField("title", value)} />
        <Field label="CTA Label" value={form.ctaLabel} onChange={(value) => updateField("ctaLabel", value)} />
        <Field label="CTA URL" value={form.ctaUrl} onChange={(value) => updateField("ctaUrl", value)} placeholder="/projects" />
        <div className="space-y-3">
          <span className="block text-xs uppercase tracking-widest text-warm-gray">Hero Media Type</span>
          <div className="grid grid-cols-2 gap-3">
            {(["image", "video"] as const).map((mediaType) => (
              <label
                key={mediaType}
                className={`cursor-pointer border px-4 py-3 text-sm transition-colors ${
                  form.mediaType === mediaType
                    ? "border-accent bg-cream text-charcoal"
                    : "border-stone bg-white text-warm-gray hover:border-accent"
                }`}
              >
                <input
                  type="radio"
                  name="heroMediaType"
                  value={mediaType}
                  checked={form.mediaType === mediaType}
                  onChange={() => updateField("mediaType", mediaType)}
                  className="mr-3 accent-accent"
                />
                Use {mediaType}
              </label>
            ))}
          </div>
          <p className="text-sm font-medium text-charcoal">
            Active hero media: {activeMediaType === "empty" ? "None" : activeMediaType === "video" ? "Video" : "Image"}
          </p>
          {activeMediaType !== form.mediaType && activeMediaType !== "empty" && (
            <p className="text-xs text-warm-gray">
              The selected {form.mediaType} is unavailable, so the homepage will use the {activeMediaType} fallback.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Hero Subtitle</label>
        <textarea
          rows={4}
          value={form.subtitle}
          onChange={(e) => updateField("subtitle", e.target.value)}
          className="w-full resize-y border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MediaPanel
          title="Hero Image"
          url={form.imageUrl}
          type="image"
          inputRef={imageInputRef}
          uploading={uploading === "image"}
          progress={uploading === "image" ? uploadProgress : null}
          onUpload={(e) => uploadMedia(e, "image")}
          onDelete={() => deleteMedia("image")}
        />
        <MediaPanel
          title="Hero Video"
          url={form.videoUrl}
          type="video"
          inputRef={videoInputRef}
          uploading={uploading === "video"}
          progress={uploading === "video" ? uploadProgress : null}
          onUpload={(e) => uploadMedia(e, "video")}
          onDelete={() => deleteMedia("video")}
        />
      </div>

      <div className="border-t border-stone/40 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="bg-charcoal px-8 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Homepage Hero"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
      />
    </div>
  );
}

function MediaPanel({
  title,
  url,
  type,
  inputRef,
  uploading,
  progress,
  onUpload,
  onDelete,
}: {
  title: string;
  url: string | null;
  type: "image" | "video";
  inputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  progress: number | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}) {
  const inputId = `homepage-${type}-upload`;

  return (
    <div className="space-y-4 border border-stone/60 bg-white p-5">
      <h2 className="text-xs uppercase tracking-widest text-warm-gray">{title}</h2>
      {url ? (
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden bg-stone/30">
            {type === "image" ? (
              <SmartImage src={url} alt={title} fill className="object-cover" sizes="600px" />
            ) : (
              <HeroVideoPreview url={url} />
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={uploading}
            className="text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            Delete {type}
          </button>
        </div>
      ) : (
        <p className="text-sm text-warm-gray">No {type} uploaded.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={type === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"}
        onChange={onUpload}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`inline-block cursor-pointer border border-dashed border-stone px-6 py-4 text-sm text-warm-gray transition-colors hover:border-accent hover:text-accent ${
          uploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {uploading ? "Uploading..." : url ? `Replace ${type}` : `+ Upload ${type}`}
      </label>
      <UploadProgress progress={progress} label={`Uploading hero ${type}`} />
      <p className="text-xs text-warm-gray">
        {type === "video" ? "Maximum 200MB. Supported: MP4/WebM." : "Maximum 200MB. Supported: JPG/PNG/WebP."}
      </p>
    </div>
  );
}

function normalizeHero(hero: Partial<HomepageHeroData>): HomepageHeroData {
  const title = hero.title?.trim();

  return {
    title: title && !LEGACY_HERO_TITLES.includes(title) ? title : HERO_BRAND_TITLE,
    subtitle: hero.subtitle ?? "",
    ctaLabel: hero.ctaLabel ?? "",
    ctaUrl: hero.ctaUrl ?? "",
    mediaType: hero.mediaType === "video" ? "video" : "image",
    imageUrl: hero.imageUrl ?? null,
    videoUrl: hero.videoUrl ?? null,
  };
}

function validateMediaFile(file: File, mediaType: "image" | "video") {
  const allowedTypes = mediaType === "image"
    ? ["image/jpeg", "image/png", "image/webp"]
    : ["video/mp4", "video/webm"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(mediaType === "video" ? "Maximum 200MB. Supported: MP4/WebM." : "Unsupported image type.");
  }
  if (file.size > 200 * 1024 * 1024) {
    throw new Error(mediaType === "video" ? "Maximum 200MB. Supported: MP4/WebM." : "Image file size must be 200MB or less.");
  }
}

function resolveActiveMediaType(hero: HomepageHeroData): "image" | "video" | "empty" {
  if (hero.mediaType === "video") return hero.videoUrl ? "video" : hero.imageUrl ? "image" : "empty";
  return hero.imageUrl ? "image" : hero.videoUrl ? "video" : "empty";
}

function HeroVideoPreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone/25 px-6 text-center text-sm text-warm-gray">
        Video preview unavailable. The uploaded file is still saved.
      </div>
    );
  }

  return (
    <video
      key={url}
      src={url}
      className="h-full w-full object-cover"
      muted
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}
