import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV, OBJECTS } from "@/lib/objects";
import { signOut } from "@/app/login/actions";
import NavTabs from "@/components/NavTabs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name,email,role").eq("id", uid).single();

  const tabs = [
    { href: "/", label: "Home" },
    ...NAV.map((k) => ({ href: `/${k}`, label: OBJECTS[k].plural })),
    { href: "/pipeline", label: "Pipeline" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="flex items-center gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 text-brand">
            <span className="flex h-8 w-11 items-center justify-center rounded-full bg-brand text-lg text-white">☁</span>
            <span className="hidden font-semibold sm:inline">Sales</span>
          </Link>
          <form action="/search" className="mx-auto w-full max-w-xl">
            <input name="q" className="input rounded-full bg-surface px-4" placeholder="Search accounts, contacts, leads, opportunities…" />
          </form>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-right leading-tight md:block">
              <span className="block font-medium">{profile?.full_name ?? profile?.email}</span>
              <span className="block text-xs capitalize text-muted">{profile?.role?.replace("_", " ")}</span>
            </span>
            <form action={signOut}>
              <button className="btn">Log out</button>
            </form>
          </div>
        </div>
        <NavTabs tabs={tabs} />
      </header>
      <main className="mx-auto max-w-[1400px] p-4">{children}</main>
    </div>
  );
}
