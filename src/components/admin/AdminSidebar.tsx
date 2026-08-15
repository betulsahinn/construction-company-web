"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/i18n";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/about", label: "About" },
  { href: "/admin/contact", label: "Contact" },
  { href: "/admin/footer", label: "Footer" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-stone/40 bg-charcoal md:w-64 md:border-b-0 md:border-r">
      <div className="p-6">
        <Link href="/admin" className="font-display text-xl text-cream">
          Admin<span className="text-accent-light">.</span>
        </Link>
        <p className="mt-1 text-xs text-stone/60">{BRAND_NAME}</p>
      </div>

      <nav className="flex gap-1 px-4 pb-4 md:flex-col md:px-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded px-4 py-2.5 text-sm transition-colors",
              pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))
                ? "bg-accent/20 text-accent-light"
                : "text-stone/70 hover:bg-stone/10 hover:text-cream",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="hidden border-t border-stone/20 p-4 md:block">
        <Link href="/" className="text-xs text-stone/50 transition-colors hover:text-cream">
          &larr; View Site
        </Link>
      </div>
    </aside>
  );
}
