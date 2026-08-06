import type { Metadata } from "next";

export const metadata: Metadata = { title: "About Us", description: "Learn about Kigali Rent - Rwanda's trusted luxury real estate agency." };

export default function AboutPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">ABOUT US</span>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-8">
          Rwanda&apos;s Premier Real Estate Agency
        </h1>
        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed space-y-6">
          <p>
            Since 2014, Kigali Rent has been the trusted name for discerning clients seeking premium properties in Rwanda&apos;s capital.
            We deliver unparalleled service, deep local expertise, and complete transparency.
          </p>
          <p>
            Our team of experienced agents specializes in luxury homes, furnished rentals, and prime land investments across all Kigali districts.
            Whether you&apos;re a local buyer, diaspora investor, or expat relocating to Rwanda, we&apos;re here to guide you every step of the way.
          </p>
        </div>
      </div>
    </div>
  );
}
