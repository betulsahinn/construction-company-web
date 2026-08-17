"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactSettingsView } from "@/lib/site-settings";

type ContactSettingsFormProps = {
  initialData: ContactSettingsView;
};

const fields: Array<{
  key: keyof ContactSettingsView;
  label: string;
  textarea?: boolean;
}> = [
  { key: "businessName", label: "Business Name" },
  { key: "city", label: "City" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "instagramUrl", label: "Instagram URL" },
  { key: "instagramHandle", label: "Instagram Handle" },
  { key: "address", label: "Address", textarea: true },
  { key: "mapsUrl", label: "Google Maps URL" },
  { key: "titleTr", label: "Contact Intro Title (TR)" },
  { key: "titleEn", label: "Contact Intro Title (EN)" },
  { key: "introTr", label: "Contact Intro Text (TR)", textarea: true },
  { key: "introEn", label: "Contact Intro Text (EN)", textarea: true },
];

export function ContactSettingsForm({ initialData }: ContactSettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(key: keyof ContactSettingsView, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = Object.fromEntries(fields.map((field) => [field.key, form[field.key] ?? ""]));
      const res = await fetch("/api/contact-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save contact settings");
      }

      setMessage("Contact settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <section className="grid gap-6 md:grid-cols-2">
        {fields.map((field) =>
          field.textarea ? (
            <div key={field.key} className="md:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{field.label}</label>
              <textarea
                rows={4}
                value={form[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="w-full resize-y border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
              />
            </div>
          ) : (
            <div key={field.key}>
              <label className="mb-2 block text-xs uppercase tracking-widest text-warm-gray">{field.label}</label>
              <input
                type="text"
                value={form[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent"
              />
            </div>
          ),
        )}
      </section>

      <div className="border-t border-stone/40 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="bg-charcoal px-8 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Contact Settings"}
        </button>
      </div>
    </form>
  );
}
