"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingCTAs } from "@/features/home/content-sections";

const DEFAULT_PHONE = process.env.NEXT_PUBLIC_PHONE || "+250784806641";
const DEFAULT_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641";

export function SiteChrome({
  children,
  phone = DEFAULT_PHONE,
  whatsapp = DEFAULT_WHATSAPP,
}: {
  children: React.ReactNode;
  phone?: string;
  whatsapp?: string;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar />
      <Navbar />
      <main>{children}</main>
      <Footer phone={phone} whatsapp={whatsapp} />
      <FloatingCTAs phone={phone} whatsapp={whatsapp} />
    </>
  );
}
