"use client";

import { useState } from "react";

type DisplayFaq = { id: string; question: string; answer: string };

export function FaqAccordion({ faqs }: { faqs: DisplayFaq[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="border-t border-stone/70">
      {faqs.map((faq, index) => {
        const open = faq.id === openId;
        return (
          <div key={faq.id} className="border-b border-stone/70">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`faq-answer-${faq.id}`}
              onClick={() => setOpenId(open ? null : faq.id)}
              className="flex w-full items-center gap-6 py-8 text-left"
            >
              <span className="text-xs tracking-[0.25em] text-accent">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1 font-display text-2xl leading-tight md:text-3xl">{faq.question}</span>
              <span className={`text-2xl text-accent transition-transform ${open ? "rotate-45" : ""}`}>+</span>
            </button>
            <div
              id={`faq-answer-${faq.id}`}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-3xl pb-9 pl-12 text-base leading-8 text-warm-gray md:pl-16">{faq.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
