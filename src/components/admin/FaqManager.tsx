"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FaqRecord } from "@/lib/faq-service";

type FaqForm = Pick<FaqRecord, "questionEn" | "answerEn" | "questionTr" | "answerTr" | "sortOrder" | "published">;

const emptyForm: FaqForm = {
  questionEn: "", answerEn: "", questionTr: "", answerTr: "", sortOrder: 0, published: true,
};

export function FaqManager({ initialFaqs }: { initialFaqs: FaqRecord[] }) {
  const router = useRouter();
  const [faqs, setFaqs] = useState(initialFaqs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>({ ...emptyForm, sortOrder: nextOrder(initialFaqs) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function reset(nextFaqs = faqs) {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: nextOrder(nextFaqs) });
  }

  function edit(faq: FaqRecord) {
    setEditingId(faq.id);
    setForm({
      questionEn: faq.questionEn, answerEn: faq.answerEn,
      questionTr: faq.questionTr, answerTr: faq.answerTr,
      sortOrder: faq.sortOrder, published: faq.published,
    });
    setError("");
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/faqs/${editingId}` : "/api/faqs", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null) as FaqRecord & { error?: string } | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Failed to save FAQ");
      const nextFaqs = sortFaqs(editingId ? faqs.map((faq) => faq.id === data.id ? data : faq) : [...faqs, data]);
      setFaqs(nextFaqs);
      reset(nextFaqs);
      setMessage(editingId ? "FAQ updated." : "FAQ added.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save FAQ");
    } finally { setLoading(false); }
  }

  async function remove(faq: FaqRecord) {
    if (!confirm(`Delete FAQ "${faq.questionEn}"?`)) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/faqs/${faq.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to delete FAQ");
      const nextFaqs = faqs.filter((item) => item.id !== faq.id);
      setFaqs(nextFaqs); reset(nextFaqs); setMessage("FAQ deleted."); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete FAQ");
    } finally { setLoading(false); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;
    const reordered = [...faqs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((faq, sortOrder) => ({ ...faq, sortOrder }));
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/faqs/reorder", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: normalized.map(({ id, sortOrder }) => ({ id, sortOrder })) }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to reorder FAQs");
      setFaqs(normalized); setMessage("FAQ order updated."); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder FAQs");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      {error && <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      <form onSubmit={save} className="space-y-5 border border-stone/60 bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <FaqField label="Question (EN)" value={form.questionEn} onChange={(value) => setForm({ ...form, questionEn: value })} />
          <FaqField label="Question (TR)" value={form.questionTr} onChange={(value) => setForm({ ...form, questionTr: value })} />
          <FaqField label="Answer (EN)" value={form.answerEn} onChange={(value) => setForm({ ...form, answerEn: value })} textarea />
          <FaqField label="Answer (TR)" value={form.answerTr} onChange={(value) => setForm({ ...form, answerTr: value })} textarea />
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="block text-xs uppercase tracking-widest text-warm-gray">
            Sort Order
            <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="mt-2 block w-28 border border-stone px-3 py-2 text-charcoal" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 accent-accent" /> Published</label>
          <button disabled={loading} className="bg-charcoal px-6 py-3 text-xs uppercase tracking-widest text-cream disabled:opacity-50">{loading ? "Saving..." : editingId ? "Save FAQ" : "Add FAQ"}</button>
          {editingId && <button type="button" onClick={() => reset()} className="border border-stone px-6 py-3 text-xs uppercase tracking-widest">Cancel</button>}
        </div>
      </form>
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <article key={faq.id} className="flex flex-col gap-4 border border-stone/60 bg-white p-5 md:flex-row md:items-start">
            <div className="flex gap-1">
              <button type="button" disabled={loading || index === 0} onClick={() => move(index, -1)} className="px-2 py-1 disabled:opacity-30" aria-label="Move FAQ up">↑</button>
              <button type="button" disabled={loading || index === faqs.length - 1} onClick={() => move(index, 1)} className="px-2 py-1 disabled:opacity-30" aria-label="Move FAQ down">↓</button>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl">{faq.questionEn}</h2><span className={`px-2 py-1 text-xs uppercase ${faq.published ? "bg-green-100 text-green-800" : "bg-stone/30 text-warm-gray"}`}>{faq.published ? "Published" : "Draft"}</span></div>
              <p className="mt-2 text-sm leading-6 text-warm-gray">{faq.answerEn}</p>
              <p className="mt-4 text-sm font-medium">{faq.questionTr}</p>
              <p className="mt-1 text-sm leading-6 text-warm-gray">{faq.answerTr}</p>
            </div>
            <div className="flex gap-4"><button type="button" onClick={() => edit(faq)} className="text-sm text-accent">Edit</button><button type="button" onClick={() => remove(faq)} className="text-sm text-red-600">Delete</button></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FaqField({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  const className = "mt-2 w-full border border-stone bg-white px-4 py-3 text-charcoal outline-none focus:border-accent";
  return <label className="block text-xs uppercase tracking-widest text-warm-gray">{label}{textarea ? <textarea required rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={className} /> : <input required value={value} onChange={(e) => onChange(e.target.value)} className={className} />}</label>;
}

function nextOrder(faqs: FaqRecord[]) { return Math.max(-1, ...faqs.map((faq) => faq.sortOrder)) + 1; }
function sortFaqs(faqs: FaqRecord[]) { return [...faqs].sort((a, b) => a.sortOrder - b.sortOrder); }
