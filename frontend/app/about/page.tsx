import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Kigali Rent is Kigali’s rental and property marketplace — housing costs, neighbourhoods, and listings you can actually view.",
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
            Kigali Rent exists to answer practical questions: what housing costs, where people actually live, what each neighbourhood is like, and which properties are available to view now.
          </p>
          <p>
            We list rentals, furnished homes, and properties for sale across Gasabo, Kicukiro, Nyarugenge, and selected areas outside the city. Neighbourhood guides sit next to live listings so you are not choosing a hill from a slogan.
          </p>
        </div>
      </div>
    </div>
  );
}
