"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageManager } from "./ImageManager";
import { PdfManager } from "./PdfManager";
import { generateProjectDescriptions } from "@/lib/description-generator";

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

type CategoryOption = {
  id: string;
  name: string;
};

type ProjectFormData = {
  id?: string;
  title: string;
  titleTr: string;
  titleEn: string;
  slug: string;
  description: string;
  descriptionTr: string;
  descriptionEn: string;
  location: string;
  year: string;
  categoryIds: string[];
  pdfUrl: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  images: ProjectImage[];
};

type ProjectFormProps = {
  categories: CategoryOption[];
  initialData?: ProjectFormData;
  mode: "create" | "edit";
};

const defaultData: ProjectFormData = {
  title: "",
  titleTr: "",
  titleEn: "",
  slug: "",
  description: "",
  descriptionTr: "",
  descriptionEn: "",
  location: "",
  year: "",
  categoryIds: [],
  pdfUrl: null,
  featured: false,
  published: false,
  sortOrder: 1,
  images: [],
};

export function ProjectForm({ categories, initialData, mode }: ProjectFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectFormData>(initialData ?? defaultData);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(mode === "edit" && Boolean(initialData?.slug));

  const primaryTitle = useMemo(
    () => form.titleTr || form.titleEn || form.title,
    [form.title, form.titleEn, form.titleTr],
  );

  function updateField<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTitleField(key: "titleTr" | "titleEn", value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (mode === "edit") return next;

      const nextPrimaryTitle = next.titleTr || next.titleEn || next.title;
      return {
        ...next,
        title: nextPrimaryTitle,
        slug: slugEdited ? next.slug : createSlugPreview(nextPrimaryTitle),
      };
    });
  }

  function updateSlug(value: string) {
    setSlugEdited(true);
    updateField("slug", createSlugPreview(value));
  }

  function regenerateSlug() {
    setSlugEdited(mode === "edit");
    updateField("slug", createSlugPreview(primaryTitle));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const saveAction = submitter?.dataset.action === "back" ? "back" : "stay";
      const url = mode === "create" ? "/api/projects" : `/api/projects/${form.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const formData = new FormData(e.currentTarget);
      const featured = formData.has("featured");
      const published = formData.has("published");

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: primaryTitle,
          titleTr: form.titleTr || null,
          titleEn: form.titleEn || null,
          slug: form.slug || createSlugPreview(primaryTitle),
          description: form.descriptionTr || form.descriptionEn || form.description || null,
          descriptionTr: form.descriptionTr || null,
          descriptionEn: form.descriptionEn || null,
          location: form.location || null,
          year: form.year ? parseInt(form.year, 10) : null,
          categoryIds: form.categoryIds,
          pdfUrl: form.pdfUrl,
          featured,
          published,
          sortOrder: form.sortOrder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save project");
      }

      const project = await res.json();
      if (project.featured !== featured || project.published !== published) {
        throw new Error("The database did not save the Published/Featured values. Please try again.");
      }

      if (saveAction === "back") {
        router.push("/admin/projects");
      } else {
        setForm((prev) => ({
          ...prev,
          id: project.id,
          slug: project.slug,
          title: project.title,
          titleTr: project.titleTr ?? "",
          titleEn: project.titleEn ?? "",
          description: project.description ?? "",
          descriptionTr: project.descriptionTr ?? "",
          descriptionEn: project.descriptionEn ?? "",
          location: project.location ?? "",
          year: project.year ? String(project.year) : "",
          categoryIds: project.categories?.map(({ category }: { category: CategoryOption }) => category.id) ?? prev.categoryIds,
          pdfUrl: project.pdfUrl ?? null,
          featured: project.featured,
          published: project.published,
          sortOrder: project.sortOrder,
          images: project.images ?? prev.images,
        }));
        setSlugEdited(true);
        setMessage(`Project saved. Status: ${project.published ? "Published" : "Draft"}; Featured: ${project.featured ? "Yes" : "No"}.`);
        if (mode === "create") {
          router.push(`/admin/projects/${project.id}/edit`);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!form.id || !confirm("Delete this project permanently?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${form.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete project");
      }
      router.push("/admin/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setLoading(false);
    }
  }

  function toggleCategory(categoryId: string) {
    setForm((prev) => {
      const selected = new Set(prev.categoryIds);

      if (selected.has(categoryId)) {
        selected.delete(categoryId);
      } else {
        selected.add(categoryId);
      }

      return {
        ...prev,
        categoryIds: categories.filter((category) => selected.has(category.id)).map((category) => category.id),
      };
    });
  }

  const selectedCategoryNames = categories
    .filter((category) => form.categoryIds.includes(category.id))
    .map((category) => category.name);

  function generateDescription() {
    const hasDescription = Boolean(form.descriptionTr.trim() || form.descriptionEn.trim());

    if (hasDescription && !confirm("Replace the existing project descriptions with generated text?")) {
      return;
    }

    const descriptions = generateProjectDescriptions({
      titleTr: form.titleTr,
      titleEn: form.titleEn,
      fallbackTitle: form.title,
      location: form.location,
      year: form.year,
      categories: selectedCategoryNames,
    });

    setForm((prev) => ({
      ...prev,
      description: descriptions.tr,
      descriptionTr: descriptions.tr,
      descriptionEn: descriptions.en,
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Title (Turkish)</label>
          <input
            type="text"
            required
            value={form.titleTr}
            onChange={(e) => updateTitleField("titleTr", e.target.value)}
            className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Title (English)</label>
          <input
            type="text"
            value={form.titleEn}
            onChange={(e) => updateTitleField("titleEn", e.target.value)}
            className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Slug</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => updateSlug(e.target.value)}
              className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={regenerateSlug}
              className="border border-stone px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-charcoal transition-colors hover:border-accent hover:text-accent"
            >
              Regenerate slug from title
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-warm-gray">
            Slug is generated automatically from the title by default. Changing the slug will change the public project URL.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Year</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => updateField("year", e.target.value)}
            className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Categories</label>
          <details className="group relative">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between border border-stone bg-white px-4 py-3 text-charcoal outline-none transition-colors focus:border-accent [&::-webkit-details-marker]:hidden">
              <span className={selectedCategoryNames.length ? "" : "text-warm-gray"}>
                {selectedCategoryNames.length ? selectedCategoryNames.join(", ") : "Select categories"}
              </span>
              <span className="text-xs uppercase tracking-widest text-accent transition-transform group-open:rotate-180">v</span>
            </summary>
            <div className="absolute z-20 mt-2 w-full border border-stone bg-white shadow-lg">
              {categories.length ? (
                categories.map((category) => (
                  <label key={category.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-charcoal transition-colors hover:bg-cream">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    {category.name}
                  </label>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-warm-gray">No categories available.</div>
              )}
            </div>
          </details>
          <p className="mt-2 text-xs text-warm-gray">A project can belong to more than one category.</p>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => updateField("sortOrder", parseInt(e.target.value, 10) || 0)}
            className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-warm-gray">Defaults to the next available order. You can override it.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-t border-stone/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-warm-gray">Project Description</h3>
            <p className="mt-2 text-xs leading-5 text-warm-gray">
              Generate a short TR/EN description from the selected categories, title, location, and year.
            </p>
          </div>
          <button
            type="button"
            onClick={generateDescription}
            className="border border-stone px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-charcoal transition-colors hover:border-accent hover:text-accent"
          >
            Generate Description
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Description (Turkish)</label>
            <textarea
              rows={5}
              value={form.descriptionTr}
              onChange={(e) => updateField("descriptionTr", e.target.value)}
              className="w-full resize-y border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">Description (English)</label>
            <textarea
              rows={5}
              value={form.descriptionEn}
              onChange={(e) => updateField("descriptionEn", e.target.value)}
              className="w-full resize-y border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="featured"
            value="true"
            checked={form.featured}
            onChange={(e) => updateField("featured", e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Featured project
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="published"
            value="true"
            checked={form.published}
            onChange={(e) => updateField("published", e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Published
        </label>
      </div>

      {form.id && (
        <>
          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-warm-gray">Images</h3>
            <ImageManager projectId={form.id} images={form.images} onImagesChange={(images) => updateField("images", images)} />
          </div>

          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-warm-gray">PDF Presentation</h3>
            <PdfManager projectId={form.id} pdfUrl={form.pdfUrl} onPdfChange={(pdfUrl) => updateField("pdfUrl", pdfUrl)} />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-stone/40 pt-6">
        <button
          type="submit"
          data-action="stay"
          disabled={loading}
          className="bg-charcoal px-8 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create Project" : "Save Changes"}
        </button>

        <button
          type="submit"
          data-action="back"
          disabled={loading}
          className="border border-charcoal px-8 py-3 text-sm uppercase tracking-widest text-charcoal transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {loading ? "Saving..." : mode === "create" ? "Create & Back to Projects" : "Save & Back to Projects"}
        </button>

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-3 text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            Delete Project
          </button>
        )}
      </div>
    </form>
  );
}

function createSlugPreview(title: string) {
  const replacements: Record<string, string> = {
    "ı": "i",
    "İ": "i",
    "ş": "s",
    "Ş": "s",
    "ç": "c",
    "Ç": "c",
    "ğ": "g",
    "Ğ": "g",
    "ü": "u",
    "Ü": "u",
    "ö": "o",
    "Ö": "o",
  };

  const normalized = title
    .replace(/[ıİşŞçÇğĞüÜöÖ]/g, (char) => replacements[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}
