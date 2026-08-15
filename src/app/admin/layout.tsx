import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex min-h-screen flex-col md:flex-row">
        {session && <AdminSidebar />}
        <div className="flex flex-1 flex-col">
          {session && (
            <header className="flex items-center justify-between border-b border-stone/40 px-6 py-4 md:px-8">
              <p className="text-sm text-warm-gray">{session.email}</p>
              <LogoutButton />
            </header>
          )}
          <div className="flex-1 p-6 md:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
