"use client";

import { SmartImage } from "@/components/SmartImage";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFormData } from "@/lib/client-upload";
import { UploadProgress } from "@/components/admin/UploadProgress";

type Reference = {
  id: string;
  companyName: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  logoWebUrl: string | null;
  logoThumbnailUrl: string | null;
  logoFileSize: number | null;
  logoWidth: number | null;
  logoHeight: number | null;
  logoMimeType: string | null;
  sortOrder: number;
  published: boolean;
};

type ReferenceManagerProps = {
  initialReferences: Reference[];
};

type ReferenceForm = {
  companyName: string;
  websiteUrl: string;
  sortOrder: number;
  published: boolean;
};

const emptyForm: ReferenceForm = {
  companyName: "",
  websiteUrl: "",
  sortOrder: 0,
  published: true,
};

export function ReferenceManager({ initialReferences }: ReferenceManagerProps) {
  const router = useRouter();
  const [references, setReferences] = useState(initialReferences);
  const [form, setForm] = useState<ReferenceForm>({
    ...emptyForm,
    sortOrder: getNextSortOrder(initialReferences),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function startEdit(reference: Reference) {
    setEditingId(reference.id);
    setForm({
      companyName: reference.companyName,
      websiteUrl: reference.websiteUrl ?? "",
      sortOrder: reference.sortOrder,
      published: reference.published,
    });
    setError("");
    setMessage("");
  }

  function resetForm(nextReferences = references) {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: getNextSortOrder(nextReferences) });
  }

  async function saveReference(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const url = editingId ? `/api/references/${editingId}` : "/api/references";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          websiteUrl: form.websiteUrl || null,
          sortOrder: form.sortOrder,
          published: form.published,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save reference");
      }

      const reference = await res.json();
      const nextReferences = editingId
        ? references.map((item) => (item.id === reference.id ? reference : item))
        : [...references, reference];
      const sortedReferences = sortReferences(nextReferences);
      setReferences(sortedReferences);
      resetForm(sortedReferences);
      setMessage(editingId ? "Reference updated." : "Reference added.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reference");
    } finally {
      setLoading(false);
    }
  }

  async function deleteReference(reference: Reference) {
    if (!confirm(`Delete reference "${reference.companyName}"?`)) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/references/${reference.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete reference");
      }

      const nextReferences = references.filter((item) => item.id !== reference.id);
      setReferences(nextReferences);
      resetForm(nextReferences);
      setMessage("Reference deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reference");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(referenceId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(referenceId);
    setError("");
    setMessage("");

    try {
      validateImageFile(file);
      const data = new FormData();
      data.append("file", file);

      const reference = await uploadFormData<Reference>(
        `/api/references/${referenceId}/logo`,
        data,
        setUploadProgress,
      );
      setReferences((prev) => sortReferences(prev.map((item) => (item.id === reference.id ? reference : item))));
      setMessage("Logo uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploadingId(null);
      setUploadProgress(null);
      if (fileInputRefs.current[referenceId]) fileInputRefs.current[referenceId]!.value = "";
    }
  }

  async function deleteLogo(referenceId: string) {
    if (!confirm("Delete this reference logo?")) return;

    setUploadingId(referenceId);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/references/${referenceId}/logo`, { method: "DELETE" });
      if (!res.ok) {
        const response = await res.json();
        throw new Error(response.error ?? "Logo delete failed");
      }

      const reference = await res.json();
      setReferences((prev) => sortReferences(prev.map((item) => (item.id === reference.id ? reference : item))));
      setMessage("Logo deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo delete failed");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <form onSubmit={saveReference} className="border border-stone/60 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_140px]">
          <Field
            label="Company Name"
            value={form.companyName}
            onChange={(value) => setForm((prev) => ({ ...prev, companyName: value }))}
            required
          />
          <Field
            label="Website URL"
            value={form.websiteUrl}
            onChange={(value) => setForm((prev) => ({ ...prev, websiteUrl: value }))}
            placeholder="https://"
          />
          <Field
            label="Sort Order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(value) => setForm((prev) => ({ ...prev, sortOrder: parseInt(value, 10) || 0 }))}
          />
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
            className="h-4 w-4 accent-accent"
          />
          Published
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-charcoal px-7 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
          >
            {loading ? "Saving..." : editingId ? "Save Reference" : "Add Reference"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="border border-stone px-6 py-3 text-sm uppercase tracking-widest text-charcoal transition-colors hover:border-accent hover:text-accent"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-5">
        {references.map((reference) => {
          const logoUrl = reference.logoThumbnailUrl ?? reference.logoWebUrl ?? reference.logoUrl;

          return (
            <div key={reference.id} className="grid gap-5 border border-stone/60 bg-white p-5 lg:grid-cols-[180px_1fr_auto]">
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-cream">
                {logoUrl ? (
                  <SmartImage src={logoUrl} alt={`${reference.companyName} logo`} fill className="object-contain p-6" sizes="180px" />
                ) : (
                  <span className="px-5 text-center font-display text-2xl leading-tight">{reference.companyName}</span>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl">{reference.companyName}</h2>
                  <span
                    className={`px-2 py-1 text-xs uppercase tracking-wider ${
                      reference.published ? "bg-green-100 text-green-800" : "bg-stone/30 text-warm-gray"
                    }`}
                  >
                    {reference.published ? "Published" : "Draft"}
                  </span>
                </div>
                {reference.websiteUrl && (
                  <a
                    href={reference.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-accent transition-colors hover:text-charcoal"
                  >
                    {reference.websiteUrl}
                  </a>
                )}
                <p className="mt-3 text-sm text-warm-gray">Sort order: {reference.sortOrder}</p>
                {reference.logoFileSize && (
                  <p className="mt-1 text-xs text-warm-gray">
                    {formatFileSize(reference.logoFileSize)}
                    {reference.logoWidth && reference.logoHeight ? ` - ${reference.logoWidth} x ${reference.logoHeight}` : ""}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-start gap-3 lg:flex-col">
                <button
                  type="button"
                  onClick={() => startEdit(reference)}
                  className="text-sm text-accent transition-colors hover:text-charcoal"
                >
                  Edit
                </button>
                <input
                  ref={(node) => {
                    fileInputRefs.current[reference.id] = node;
                  }}
                  id={`reference-logo-${reference.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => uploadLogo(reference.id, e)}
                  className="hidden"
                />
                <label
                  htmlFor={`reference-logo-${reference.id}`}
                  className={`cursor-pointer text-sm text-warm-gray transition-colors hover:text-accent ${
                    uploadingId === reference.id ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {uploadingId === reference.id ? "Uploading..." : logoUrl ? "Replace Logo" : "Upload Logo"}
                </label>
                {uploadingId === reference.id && (
                  <div className="w-full min-w-36">
                    <UploadProgress progress={uploadProgress} label="Uploading logo" />
                  </div>
                )}
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => deleteLogo(reference.id)}
                    className="text-sm text-warm-gray transition-colors hover:text-red-700"
                  >
                    Delete Logo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteReference(reference)}
                  className="text-sm text-red-600 transition-colors hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
      />
    </div>
  );
}

function getNextSortOrder(references: Reference[]) {
  return Math.max(-1, ...references.map((reference) => reference.sortOrder)) + 1;
}

function sortReferences(references: Reference[]) {
  return [...references].sort((a, b) => a.sortOrder - b.sortOrder || a.companyName.localeCompare(b.companyName));
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
