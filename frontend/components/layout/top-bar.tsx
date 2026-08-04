"use client";

import Link from "next/link";
import { Facebook, Instagram, Linkedin, MapPin, Clock, Phone, Youtube } from "lucide-react";

interface TopBarProps {
  address?: string;
  hours?: string;
  phone?: string;
  social?: Record<string, string>;
}

export function TopBar({
  address = "KN 4 St, Kigali, Rwanda",
  hours = "Mon - Sat: 8:00 AM - 7:00 PM",
  phone = "+250 784 806 641",
  social = {},
}: TopBarProps) {
  const facebook = social.facebook || "#";
  const instagram = social.instagram || "#";
  const linkedin = social.linkedin || "#";
  const youtube = social.youtube || "https://www.youtube.com";

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
          </div>
        </div>
      </div>
    </div>
  );
}
