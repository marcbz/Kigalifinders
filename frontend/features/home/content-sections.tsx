"use client";

import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus, Minus } from "lucide-react";
import type { BlogPost, FAQ } from "@/types";

export function FAQSection({ faqs }: { faqs: FAQ[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="py-20 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">FREQUENTLY ASKED</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">Your Questions Answered</h2>
          <div className="section-divider mx-auto" />
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.id} className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden">
              <button
                className="w-full text-left p-6 flex justify-between items-center font-semibold text-navy-800 dark:text-white"
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              >
                <span>{faq.question}</span>
                {openId === faq.id ? <Minus className="w-5 h-5 text-gold-500" /> : <Plus className="w-5 h-5 text-gold-500" />}
              </button>
              {openId === faq.id && (
                <div className="px-6 pb-6 text-gray-600 dark:text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: faq.answer }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  return (
    <section id="blog" className="py-20 px-6 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">INSIGHTS & GUIDES</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">Latest from Our Blog</h2>
          <div className="section-divider mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group">
              <div className="overflow-hidden rounded-xl mb-5 h-56 relative">
                <Image
                  src={post.featured_image || "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800"}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-500"
                  sizes="33vw"
                />
              </div>
              <div className="text-xs text-gold-500 tracking-widest mb-2">
                {post.category_name?.toUpperCase()} · {post.read_time_minutes} MIN READ
              </div>
              <h3 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-3 group-hover:text-gold-500 transition">{post.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{post.excerpt}</p>
            </Link>
          ))}
        </div>
        {posts.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href="/blog"
              className="inline-flex items-center gap-3 border-2 border-navy-800 dark:border-gold-500 text-navy-800 dark:text-gold-500 hover:bg-navy-800 hover:text-gold-500 dark:hover:bg-gold-500 dark:hover:text-navy-900 px-8 py-3.5 rounded-full font-semibold transition"
            >
              View All Posts <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function CTASection({ bookingUrl, whatsapp }: { bookingUrl?: string; whatsapp?: string }) {
  const resolvedBookingUrl = bookingUrl?.trim() || "https://secure-guard.setmore.com/";
  const resolvedWhatsapp = whatsapp?.trim() || "250784806641";
  return (
    <section id="contact" className="py-24 px-6 relative bg-gradient-to-br from-navy-800 to-navy-700">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="max-w-5xl mx-auto relative text-center text-white">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">READY TO MOVE?</span>
        <h2 className="font-serif text-4xl md:text-6xl font-bold mt-4 mb-6 leading-tight">
          Let&apos;s Find Your <span className="gold-text italic">Perfect Property</span>
        </h2>
        <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
          Speak to a Kigali Rent advisor today. Book a free consultation and start your real estate journey.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href={resolvedBookingUrl} target="_blank" rel="noopener noreferrer" className="btn-gold px-8 py-4 rounded-full font-semibold inline-flex items-center gap-2">
            Book Free Consultation
          </a>
          <a href={`https://wa.me/${resolvedWhatsapp}?text=Hello%20Kigali%20Rent`} className="btn-outline-white px-8 py-4 rounded-full font-semibold inline-flex items-center gap-2">
            WhatsApp Us
          </a>
        </div>
      </div>
    </section>
  );
}

export function NewsletterSection() {
  return (
    <section className="py-16 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="font-serif text-3xl font-bold text-navy-800 dark:text-white mb-3">Get Property Alerts</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Be the first to know about new listings and exclusive opportunities.</p>
        <form className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Your email address" className="lux-input flex-1" required />
          <button type="submit" className="btn-gold px-8 py-3.5 rounded-md font-semibold whitespace-nowrap">Subscribe</button>
        </form>
      </div>
    </section>
  );
}

export function MapSection({
  address,
  phone,
  hours,
  latitude,
  longitude,
}: {
  address?: string;
  phone?: string;
  hours?: string;
  latitude?: number;
  longitude?: number;
}) {
  const mapSrc =
    latitude && longitude
      ? `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2000!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2srw!4v1700000000000`
      : "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3987.7956749506064!2d30.058775!3d-1.944072!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1sKigali!5e0!3m2!1sen!2srw!4v1700000000000";

  return (
    <section className="py-20 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">VISIT OUR OFFICE</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-6">Find Us in the Heart of Kigali</h2>
            <div className="section-divider mb-6" />
            <div className="space-y-5 text-sm">
              <div><strong className="text-navy-800 dark:text-white">Address</strong><br />{address}</div>
              <div><strong className="text-navy-800 dark:text-white">Phone</strong><br /><a href={`tel:${phone?.replace(/\s/g, "")}`} className="hover:text-gold-500">{phone}</a></div>
              <div><strong className="text-navy-800 dark:text-white">Hours</strong><br />{hours}</div>
            </div>
          </div>
          <div className="w-full max-w-md">
            <div className="rounded-xl overflow-hidden shadow-lg aspect-square max-h-[320px] border border-gray-200 dark:border-border">
            <iframe
              className="w-full h-full grayscale-[20%] contrast-105 border-0"
              src={mapSrc}
              loading="lazy"
              title="Kigali Rent Office Location"
            />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FloatingCTAs({ phone, whatsapp }: { phone?: string; whatsapp?: string }) {
  return (
    <>
      <a
        href={`tel:${phone?.replace(/\s/g, "")}`}
        className="fixed bottom-[100px] right-6 z-[60] bg-sky-brand hover:bg-sky-brand-hover text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-xl transition-colors"
        title="Call Now"
      >
        📞
      </a>
      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[60] bg-[#25D366] text-white w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-xl animate-float"
        title="WhatsApp"
      >
        <WhatsAppIcon className="w-8 h-8" />
      </a>
    </>
  );
}
