import { FaqManager } from "@/components/admin/FaqManager";
import { listFaqs } from "@/lib/faq-service";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const faqs = await listFaqs();
  return (
    <div>
      <h1 className="font-display text-3xl tracking-wide">FAQ</h1>
      <p className="mt-1 text-sm text-warm-gray">Manage bilingual questions shown on the public FAQ page.</p>
      <div className="mt-8"><FaqManager initialFaqs={faqs} /></div>
    </div>
  );
}
