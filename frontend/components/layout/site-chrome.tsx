"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingCTAs } from "@/features/home/content-sections";

export function SiteChrome({ children }: { children: React.ReactNode }) {
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
      <Footer />
      <FloatingCTAs phone="+250784806641" whatsapp="250784806641" />
    </>
  );
}
