import Link from "next/link";
import { Facebook, Instagram, Linkedin, MapPin, Clock, Phone, Youtube } from "lucide-react";
import { SITE_ADDRESS, SITE_HOURS, SITE_SOCIAL } from "@/lib/site-defaults";
import { TikTokIcon } from "@/components/icons/tiktok-icon";

interface TopBarProps {
  address?: string;
  hours?: string;
  phone?: string;
  social?: Record<string, string>;
}

export function TopBar({
  address = SITE_ADDRESS,
  hours = SITE_HOURS,
  phone = "+250 784 806 641",
  social = SITE_SOCIAL,
}: TopBarProps) {
  const facebook = social.facebook || SITE_SOCIAL.facebook;
  const instagram = social.instagram || SITE_SOCIAL.instagram;
  const linkedin = social.linkedin || SITE_SOCIAL.linkedin;
  const youtube = social.youtube || SITE_SOCIAL.youtube;
  const tiktok = social.tiktok || SITE_SOCIAL.tiktok;

  return (
    <div className="topbar hidden md:block bg-navy-900 text-slate-300 text-[13px]">
      <div className="max-w-7xl mx-auto px-6 py-2 flex justify-between items-center">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-gold-500" />
            {address}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gold-500" />
            {hours}
          </span>
        </div>
        <div className="flex gap-5 items-center">
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-gold-500 flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" />
            {phone}
          </a>
          <div className="flex gap-3">
            <a href={facebook} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500" aria-label="Facebook">
              <Facebook className="w-3.5 h-3.5" />
            </a>
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500" aria-label="Instagram">
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500" aria-label="LinkedIn">
              <Linkedin className="w-3.5 h-3.5" />
            </a>
            <a href={youtube} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500" aria-label="YouTube">
              <Youtube className="w-3.5 h-3.5" />
            </a>
            <a href={tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-gold-500" aria-label="TikTok">
              <TikTokIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
