"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  name: string;
  nameTr: string | null;
  nameEn: string | null;
  slug: string;
  sortOrder: number;
  _count: { projects: number };
};

type CategoryManagerProps = {
  initialCategories: Category[];
};

type CategoryForm = {
  nameTr: string;
  nameEn: string;
  sortOrder: number;
};

const emptyForm: CategoryForm = {
  nameTr: "",
  nameEn: "",
  sortOrder: 0,
};

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [form, setForm] = useState<CategoryForm>({
    ...emptyForm,
    sortOrder: getNextSortOrder(initialCategories),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      nameTr: category.nameTr ?? category.name,
      nameEn: category.nameEn ?? "",
      sortOrder: category.sortOrder,
    });
    setError("");
    setMessage("");
  }

  function resetForm(nextCategories = categories) {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: getNextSortOrder(nextCategories) });
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameTr: form.nameTr,
          nameEn: form.nameEn || null,
          sortOrder: form.sortOrder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save category");
      }

      const category = await res.json();
      const nextCategories = editingId
        ? categories.map((item) => (item.id === category.id ? category : item))
        : [...categories, category];
      const sortedCategories = sortCategories(nextCategories);
      setCategories(sortedCategories);
      resetForm(sortedCategories);
      setMessage(editingId ? "Category updated." : "Category added.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(category: Category) {
    if (category._count.projects > 0) {
      setError("This category is used by projects and cannot be deleted.");
      return;
    }

    if (!confirm(`Delete category "${category.nameTr ?? category.name}"?`)) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete category");
      }

      const nextCategories = categories.filter((item) => item.id !== category.id);
      setCategories(nextCategories);
      resetForm(nextCategories);
      setMessage("Category deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <form onSubmit={saveCategory} className="border border-stone/60 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_140px]">
          <Field
            label="Turkish Label"
            value={form.nameTr}
            onChange={(value) => setForm((prev) => ({ ...prev, nameTr: value }))}
            required
          />
          <Field
            label="English Label"
            value={form.nameEn}
            onChange={(value) => setForm((prev) => ({ ...prev, nameEn: value }))}
          />
          <Field
            label="Sort Order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(value) => setForm((prev) => ({ ...prev, sortOrder: parseInt(value, 10) || 0 }))}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-charcoal px-7 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
          >
            {loading ? "Saving..." : editingId ? "Save Category" : "Add Category"}
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

      <div className="overflow-x-auto border border-stone/60 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone/40 bg-stone/10">
            <tr>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">TR Label</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">EN Label</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Slug</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Projects</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Sort</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-stone/20 last:border-0">
                <td className="px-4 py-4">{category.nameTr ?? category.name}</td>
                <td className="px-4 py-4 text-warm-gray">{category.nameEn || "-"}</td>
                <td className="px-4 py-4 text-warm-gray">{category.slug}</td>
                <td className="px-4 py-4 text-warm-gray">{category._count.projects}</td>
                <td className="px-4 py-4 text-warm-gray">{category.sortOrder}</td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => startEdit(category)}
                    className="text-accent transition-colors hover:text-charcoal"
                  >
                    Edit
                  </button>
                  <span className="px-2 text-stone">-</span>
                  <button
                    type="button"
                    onClick={() => deleteCategory(category)}
                    className="text-red-600 transition-colors hover:text-red-800"
                    title={category._count.projects > 0 ? "Category is used by projects." : undefined}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
      />
    </div>
  );
}

function getNextSortOrder(categories: Category[]) {
  return Math.max(-1, ...categories.map((category) => category.sortOrder)) + 1;
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
