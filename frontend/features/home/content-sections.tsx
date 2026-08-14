import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { LazyGoogleMap } from "@/components/maps/lazy-google-map";
import { SITE_BOOKING_URL } from "@/lib/site-defaults";
import type { BlogPost } from "@/types";

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
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading="lazy"
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
  const resolvedBookingUrl = bookingUrl?.trim() || SITE_BOOKING_URL;
  const resolvedWhatsapp = whatsapp?.trim() || "250784806641";
  return (
    <section id="contact" className="py-24 px-6 relative bg-gradient-to-br from-navy-800 to-navy-700 overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=75"
        alt=""
        fill
        className="object-cover object-center opacity-10"
        sizes="100vw"
        loading="lazy"
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
            <div className="rounded-xl overflow-hidden shadow-lg aspect-square max-h-[320px] border border-gray-200 dark:border-border grayscale-[20%] contrast-105">
              <LazyGoogleMap src={mapSrc} title="Kigali Rent Office Location" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
