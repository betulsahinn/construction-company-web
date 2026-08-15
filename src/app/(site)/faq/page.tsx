import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { listFaqs } from "@/lib/faq-service";
import { getServerLanguage } from "@/lib/i18n-server";
import { toLanguageUppercase, translations } from "@/lib/i18n";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].faq;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/faq",
    language,
  });
}

export default async function FaqPage() {
  const [language, records] = await Promise.all([getServerLanguage(), listFaqs(true)]);
  const t = translations[language].faq;
  const faqs = records.map((faq) => ({
    id: faq.id,
    question: language === "tr" ? faq.questionTr : faq.questionEn,
    answer: language === "tr" ? faq.answerTr : faq.answerEn,
  }));

  return (
    <section className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
      <div className="studio-container">
        <div className="max-w-[760px]">
          <p className="eyebrow">{toLanguageUppercase(t.eyebrow, language)}</p>
          <h1 className="mt-7 font-display text-6xl leading-[0.95] tracking-[0.01em] md:text-[5.2rem]">{t.title}</h1>
          <p className="mt-8 text-lg leading-8 text-warm-gray">{t.intro}</p>
        </div>
        <div className="mt-16 max-w-4xl">
          {faqs.length ? <FaqAccordion faqs={faqs} /> : <p className="text-warm-gray">{t.empty}</p>}
        </div>
      </div>
    </section>
  );
}
