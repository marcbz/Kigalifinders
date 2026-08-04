"use client";

import Image from "next/image";
import { Shield, Handshake, Headphones, MapPin, Quote, Star } from "lucide-react";
import type { Testimonial } from "@/types";
import { testimonialAvatarUrl } from "@/lib/testimonial-avatars";

const features = [
  { icon: Shield, title: "Verified Listings", desc: "Every property is personally inspected and verified by our team." },
  { icon: Handshake, title: "Trusted Service", desc: "850+ happy clients across Rwanda and the diaspora." },
  { icon: Headphones, title: "24/7 Support", desc: "Round-the-clock assistance via WhatsApp, call, and email." },
  { icon: MapPin, title: "Local Expertise", desc: "Deep knowledge of every Kigali neighborhood and market trends." },
];

export function WhyUsSection() {
  return (
    <section id="why" className="py-24 px-6 bg-navy-800 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500 opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="max-w-7xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">WHY CHOOSE US</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mt-3 mb-6 leading-tight">
              A Standard of <span className="gold-text italic">Excellence</span> in Real Estate
            </h2>
            <div className="section-divider mb-6" />
            <p className="text-gray-300 mb-10 leading-relaxed">
              For over a decade, Kigalifinders has been the trusted name for discerning clients seeking premium properties in Rwanda&apos;s capital.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title}>
                  <div className="w-14 h-14 rounded-full bg-gold-500/15 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-gold-500" />
                  </div>
                  <h4 className="font-semibold mb-1">{title}</h4>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900"
              alt="Luxury home"
              width={900}
              height={600}
              className="rounded-2xl shadow-2xl"
            />
            <div className="absolute -bottom-8 -left-8 bg-white text-navy-800 p-6 rounded-xl shadow-2xl hidden md:block max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex text-gold-500">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <span className="font-bold">4.9/5</span>
              </div>
              <p className="text-sm italic">&quot;Best real estate agency in Kigali. Found my dream home in days.&quot;</p>
              <p className="text-xs text-gray-500 mt-2">— Jean B., Kacyiru</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="py-20 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">CLIENT STORIES</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">What Our Clients Say</h2>
          <div className="section-divider mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.id} className="testimonial-card p-8 rounded-xl shadow-md">
              <Quote className="w-8 h-8 text-gold-500 mb-4" />
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">&quot;{t.content}&quot;</p>
              <div className="flex items-center gap-4">
                <Image
                  src={testimonialAvatarUrl(t.name, t.avatar_url)}
                  alt={t.name}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="rounded-full object-cover w-12 h-12 shrink-0 ring-2 ring-gold-500/30"
                />
                <div>
                  <div className="font-semibold text-navy-800 dark:text-white">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}{t.location ? `, ${t.location}` : ""}</div>
                </div>
              </div>
              <div className="flex text-gold-500 mt-4">
                {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
