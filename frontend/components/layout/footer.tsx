import Link from "next/link";
import { Facebook, Instagram, Linkedin, MapPin, Phone, Clock, CalendarCheck, Youtube } from "lucide-react";
import { BrandName } from "@/components/brand/brand-name";

interface FooterProps {
  phone?: string;
  whatsapp?: string;
  address?: string;
  hours?: string;
  bookingUrl?: string;
  social?: Record<string, string>;
}

const SOCIAL_ICONS = [
  { key: "facebook", Icon: Facebook, label: "Facebook" },
  { key: "instagram", Icon: Instagram, label: "Instagram" },
  { key: "linkedin", Icon: Linkedin, label: "LinkedIn" },
  { key: "youtube", Icon: Youtube, label: "YouTube" },
] as const;

export function Footer({
  phone = "+250 784 806 641",
  whatsapp = "250784806641",
  address = "KN 4 St, Kigali, Rwanda",
  hours = "Mon-Sat: 8AM-7PM",
  bookingUrl,
  social = {},
}: FooterProps) {
  const defaultYoutube = "https://www.youtube.com";

  return (
    <footer className="pt-16 pb-8 px-6 bg-navy-900 text-slate-300">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gold-500 flex items-center justify-center">
                <span className="font-serif text-navy-800 text-sm font-bold leading-none">KR</span>
              </div>
              <div>
                <BrandName variant="light" size="md" />
                <div className="mt-1 text-[11px] tracking-[0.22em] font-semibold text-gold-400">
                  RENTALS & PROPERTY
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-400 mb-5">
              Rwanda&apos;s most trusted luxury real estate agency. Helping families and investors find their perfect property in Kigali since 2014.
            </p>
            <div className="flex gap-3">
              {SOCIAL_ICONS.map(({ key, Icon, label }) => {
                const href =
                  social[key] ||
                  (key === "youtube" ? defaultYoutube : "#");
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center hover:bg-gold-500 hover:border-gold-500 hover:text-navy-900 transition"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wider text-sm">EXPLORE</h4>
            <ul className="space-y-2 text-sm">
              {["Houses for Rent", "Furnished Houses", "Plots for Sale", "Luxury Homes"].map((item) => (
                <li key={item}><Link href="/properties" className="hover:text-gold-500 transition">{item}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wider text-sm">CONTACT</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><MapPin className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" /><span>{address}</span></li>
              <li className="flex gap-3"><Phone className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" /><a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-gold-500">{phone}</a></li>
              <li className="flex gap-3"><span className="text-gold-500">WA</span><a href={`https://wa.me/${whatsapp}`} className="hover:text-gold-500">WhatsApp Us</a></li>
              <li className="flex gap-3"><Clock className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" /><span>{hours}</span></li>
              <li className="flex gap-3"><CalendarCheck className="w-4 h-4 text-gold-500 mt-0.5 shrink-0" />
                {bookingUrl ? (
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500">Book a Visit</a>
                ) : (
                  <span>Book a Visit</span>
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div>© {new Date().getFullYear()} Kigali Rent. All rights reserved.</div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gold-500">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gold-500">Terms of Service</Link>
            <Link href="/sitemap" className="hover:text-gold-500">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
