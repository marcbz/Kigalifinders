"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingCTAs } from "@/features/home/content-sections";

export function SiteChrome({
  children,
  phone,
  whatsapp,
  address,
  hours,
  bookingUrl,
  consultationUrl,
  social,
}: {
  children: React.ReactNode;
  phone?: string;
  whatsapp?: string;
  address?: string;
  hours?: string;
  bookingUrl?: string;
  consultationUrl?: string;
  social?: Record<string, string>;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar address={address} hours={hours} phone={phone} social={social} />
      <Navbar bookingUrl={bookingUrl} />
      <main>{children}</main>
      <Footer phone={phone} whatsapp={whatsapp} address={address} hours={hours} bookingUrl={bookingUrl} />
      <FloatingCTAs phone={phone} whatsapp={whatsapp} />
    </>
  );
}
