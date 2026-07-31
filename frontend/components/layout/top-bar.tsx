"use client";

import Link from "next/link";
import { Facebook, Instagram, Linkedin, MapPin, Clock, Phone } from "lucide-react";

interface TopBarProps {
  address?: string;
  hours?: string;
  phone?: string;
}

export function TopBar({
  address = "KN 4 St, Kigali, Rwanda",
  hours = "Mon - Sat: 8:00 AM - 7:00 PM",
  phone = "+250 784 806 641",
}: TopBarProps) {
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
          <div className="flex gap-3 text-xs">
            <Link href="/en" className="hover:text-gold-500">EN</Link>
            <span className="text-gray-600">|</span>
            <Link href="/fr" className="hover:text-gold-500">FR</Link>
            <span className="text-gray-600">|</span>
            <Link href="/rw" className="hover:text-gold-500">RW</Link>
          </div>
          <div className="flex gap-3">
            <a href="#" className="hover:text-gold-500"><Facebook className="w-3.5 h-3.5" /></a>
            <a href="#" className="hover:text-gold-500"><Instagram className="w-3.5 h-3.5" /></a>
            <a href="#" className="hover:text-gold-500"><Linkedin className="w-3.5 h-3.5" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
