import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center section-padding">
      <h1 className="font-display text-6xl">404</h1>
      <p className="mt-4 text-warm-gray">Page not found</p>
      <Link href="/" className="mt-8 text-sm uppercase tracking-widest text-accent hover:text-charcoal">
        Return Home
      </Link>
    </section>
  );
}
