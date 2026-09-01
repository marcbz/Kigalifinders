import type { Metadata } from "next";
import Link from "next/link";
import { SITE_ADDRESS, SITE_BOOKING_URL, SITE_HOURS, SITE_SOCIAL } from "@/lib/site-defaults";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Kigali Rent is Kigali's rental and property marketplace — verified listings, neighbourhood guides, and published asking-rent research.",
};

export default function AboutPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">ABOUT US</span>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-8">
          Kigali&apos;s rental and property marketplace
        </h1>
        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed space-y-6">
          <p>
            <strong className="text-navy-800 dark:text-white">Kigali Rent</strong> (kigalirent.com) exists to
            answer practical questions about housing in Kigali: what asking rents look like, where people actually
            live, what each neighbourhood is like, and which properties are available to view now.
          </p>
          <p>
            We list rentals, furnished homes, and properties for sale across Gasabo, Kicukiro, Nyarugenge, and
            selected areas outside the city. Neighbourhood guides sit next to live listings so you are not choosing
            a hill from a slogan.
          </p>

          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">What we publish</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Link href="/rentals" className="text-gold-600 hover:underline">
                Verified rental listings
              </Link>{" "}
              — houses, apartments, and villas for rent in Kigali, browsable by neighbourhood and type.
            </li>
            <li>
              <Link href="/area" className="text-gold-600 hover:underline">
                Neighbourhood guides
              </Link>{" "}
              — what daily life, commute, and housing stock are like in Kibagabaga, Nyarutarama, Kimironko, and
              other Kigali areas.
            </li>
            <li>
              <Link href="/research/kigali-rental-market" className="text-gold-600 hover:underline">
                Rental market research
              </Link>{" "}
              — typical asking rents, bedroom breakdowns, and methodology with sample sizes and limitations.
            </li>
          </ul>

          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Listing verification</h2>
          <p>
            Listings on Kigali Rent are reviewed before publication. We focus on properties that are actually
            available to view, with prices and details checked against what is on the ground. When a listing is no
            longer available, it is marked accordingly rather than left live with stale information.
          </p>

          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Contact</h2>
          <p>
            Office: {SITE_ADDRESS}
            <br />
            Hours: {SITE_HOURS}
            <br />
            Phone:{" "}
            <a href="tel:+250784806641" className="text-gold-600 hover:underline">
              +250 784 806 641
            </a>
            <br />
            <Link href="/contact" className="text-gold-600 hover:underline">
              Contact form
            </Link>
            {" · "}
            <a href={SITE_BOOKING_URL} className="text-gold-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Book a consultation
            </a>
          </p>

          <p className="text-sm">
            Follow Kigali Rent:{" "}
            <a href={SITE_SOCIAL.facebook} className="text-gold-600 hover:underline" rel="noopener noreferrer" target="_blank">
              Facebook
            </a>
            ,{" "}
            <a href={SITE_SOCIAL.instagram} className="text-gold-600 hover:underline" rel="noopener noreferrer" target="_blank">
              Instagram
            </a>
            ,{" "}
            <a href={SITE_SOCIAL.linkedin} className="text-gold-600 hover:underline" rel="noopener noreferrer" target="_blank">
              LinkedIn
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
