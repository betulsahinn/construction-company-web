"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type ContactFormLabels = {
  formTitle: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  send: string;
};

type ContactFormProps = {
  labels: ContactFormLabels;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  message: "",
  website: "",
};

export function ContactForm({ labels }: ContactFormProps) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Message could not be sent. Please try again.");
      }

      setForm(initialForm);
      setStatus("success");
      setFeedback("Thank you. Your message has been sent.");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Message could not be sent. Please try again.");
    }
  }

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isLoading = status === "loading";

  return (
    <form onSubmit={handleSubmit} className="bg-white px-8 py-12 shadow-[0_1px_2px_rgba(0,0,0,0.08)] md:px-12 md:py-14">
      <h2 className="font-display text-3xl tracking-[0.02em]">{labels.formTitle}</h2>
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(event) => updateField("website", event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className="mt-10 space-y-8">
        <Field
          id="name"
          label={labels.name}
          value={form.name}
          onChange={(value) => updateField("name", value)}
          autoComplete="name"
          minLength={2}
          maxLength={120}
          disabled={isLoading}
        />
        <Field
          id="email"
          label={labels.email}
          type="email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
          autoComplete="email"
          maxLength={254}
          disabled={isLoading}
        />
        <Field
          id="phone"
          label={labels.phone}
          type="tel"
          value={form.phone}
          onChange={(value) => updateField("phone", value)}
          autoComplete="tel"
          minLength={5}
          maxLength={40}
          disabled={isLoading}
        />
        <div>
          <label htmlFor="message" className="mb-4 block text-[0.62rem] font-semibold uppercase tracking-[0.36em] text-warm-gray">
            {labels.message}
          </label>
          <textarea
            id="message"
            name="message"
            rows={7}
            value={form.message}
            onChange={(event) => updateField("message", event.target.value)}
            required
            minLength={10}
            maxLength={4000}
            disabled={isLoading}
            className="w-full resize-y border-0 border-b border-stone bg-transparent px-0 py-4 outline-none transition-colors focus:border-accent disabled:opacity-60"
          />
        </div>
      </div>
      {feedback && (
        <p
          className={`mt-6 text-sm leading-6 ${status === "success" ? "text-green-700" : "text-red-700"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      )}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-9 w-full bg-[#1d1d1b] py-5 text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cream transition-colors hover:bg-accent hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Sending..." : labels.send}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  minLength,
  maxLength,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-4 block text-[0.62rem] font-semibold uppercase tracking-[0.36em] text-warm-gray">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        className="w-full border-0 border-b border-stone bg-transparent px-0 py-4 outline-none transition-colors focus:border-accent disabled:opacity-60"
      />
    </div>
  );
}
