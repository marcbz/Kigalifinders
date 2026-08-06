import type { NeighborhoodSummary } from "@/lib/areas";

export type AreaSeoContent = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string[];
  highlights: string[];
};

const AREA_COPY: Record<string, Omit<AreaSeoContent, "metaTitle" | "metaDescription" | "headline">> = {
  nyarutarama: {
    intro: [
      "Nyarutarama is one of Kigali's most prestigious residential neighborhoods, known for leafy streets, diplomatic residences, and upscale villas. Families and professionals choose this area for its security, proximity to international schools, and calm hillside setting.",
      "Kigali Rent helps you find verified rental homes, furnished apartments, and investment properties in Nyarutarama — with transparent pricing and guided viewings.",
    ],
    highlights: ["Upscale villas & apartments", "Near embassies & international schools", "Quiet, secure residential streets"],
  },
  kibagabaga: {
    intro: [
      "Kibagabaga is a fast-growing Kigali neighborhood popular with families and young professionals. It offers a strong mix of standalone houses, modern apartments, and affordable rental options with good road access across Gasabo.",
      "Browse current listings in Kibagabaga with Kigali Rent — from furnished homes to long-term rentals and plots for development.",
    ],
    highlights: ["Family-friendly housing", "Strong rental demand", "Easy access across Gasabo"],
  },
  kacyiru: {
    intro: [
      "Kacyiru sits at the heart of Kigali's business district, making it ideal for executives, NGO staff, and expats who want a short commute. Expect modern apartments, serviced units, and premium homes close to offices and amenities.",
      "Explore verified Kacyiru rentals and sales listings updated regularly by our local team.",
    ],
    highlights: ["Central business district", "Popular with expats & professionals", "Modern apartments & serviced units"],
  },
  kimironko: {
    intro: [
      "Kimironko blends everyday convenience with growing residential appeal. The area is well known for its market, transport links, and a wide range of rental homes suited to families and first-time renters in Kigali.",
      "Find houses, apartments, and value-driven rentals in Kimironko through Kigali Rent.",
    ],
    highlights: ["Excellent local amenities", "Wide range of price points", "Strong connectivity"],
  },
  remera: {
    intro: [
      "Remera is a vibrant Kigali neighborhood with excellent access to the city center, Amahoro Stadium, and major roads. It attracts renters looking for practical apartments, family homes, and good urban convenience.",
      "See available properties in Remera — updated listings with photos, pricing, and viewing support.",
    ],
    highlights: ["Central location", "Apartments & family homes", "Great urban convenience"],
  },
  kiyovu: {
    intro: [
      "Kiyovu is a historic and central Kigali neighborhood with character homes, renovated apartments, and proximity to downtown. It appeals to renters who want to be close to the city's cultural and business core.",
      "Discover rental and investment opportunities in Kiyovu with trusted local guidance from Kigali Rent.",
    ],
    highlights: ["Historic central neighborhood", "Walkable city access", "Character homes & apartments"],
  },
  gacuriro: {
    intro: [
      "Gacuriro is a hillside neighborhood in Gasabo with panoramic views and a growing selection of modern homes. It is popular with families seeking space, privacy, and newer construction.",
      "Browse Gacuriro houses and apartments for rent or sale — verified by our on-the-ground team.",
    ],
    highlights: ["Hillside views", "Newer residential developments", "Family-oriented living"],
  },
  kimihurura: {
    intro: [
      "Kimihurura is an established diplomatic and residential area in Kigali, offering premium homes, quiet streets, and proximity to key institutions. It remains a top choice for long-term expat rentals.",
      "View curated Kimihurura listings — villas, furnished homes, and executive apartments.",
    ],
    highlights: ["Diplomatic quarter proximity", "Premium long-term rentals", "Secure residential environment"],
  },
  rebero: {
    intro: [
      "Rebero is a sought-after Kicukiro neighborhood with hillside views and a mix of standalone houses and apartments. Renters appreciate the balance of tranquility and access to southern Kigali.",
      "Find homes and rental properties in Rebero with up-to-date listings from Kigali Rent.",
    ],
    highlights: ["Hillside homes with views", "Kicukiro location", "Mix of houses & apartments"],
  },
  gisozi: {
    intro: [
      "Gisozi is a well-connected Gasabo neighborhood known for practical family housing and steady rental demand. It suits buyers and renters looking for value within easy reach of central Kigali.",
      "Explore Gisozi property listings — houses, apartments, and investment options.",
    ],
    highlights: ["Well-connected location", "Steady rental market", "Family housing options"],
  },
  kagarama: {
    intro: [
      "Kagarama in Kicukiro offers accessible rental housing for families and professionals working across Kigali. The area continues to grow with new residential developments and competitive pricing.",
      "See available Kagarama rentals and homes listed by Kigali Rent.",
    ],
    highlights: ["Growing residential area", "Competitive rental prices", "Kicukiro access"],
  },
  kagugu: {
    intro: [
      "Kagugu is a developing Gasabo neighborhood attracting renters and buyers looking for newer homes and room to grow. It is increasingly popular for long-term residential investment.",
      "Browse Kagugu properties — houses and apartments listed with transparent details.",
    ],
    highlights: ["Emerging residential zone", "Newer housing stock", "Investment potential"],
  },
};

function defaultCopy(name: string, districtName?: string | null): Omit<AreaSeoContent, "metaTitle" | "metaDescription" | "headline"> {
  const district = districtName ? ` in ${districtName}` : " in Kigali";
  return {
    intro: [
      `${name} is a residential neighborhood${district}, Rwanda. Renters and buyers choose this area for its local character, access to amenities, and range of housing options across different budgets.`,
      `Kigali Rent lists verified homes, apartments, and plots in ${name} with accurate details and supported property viewings.`,
    ],
    highlights: ["Verified local listings", "Rental & sale properties", "Guided viewings available"],
  };
}

export function getAreaSeoContent(neighborhood: NeighborhoodSummary): AreaSeoContent {
  const custom = AREA_COPY[neighborhood.slug] ?? defaultCopy(neighborhood.name, neighborhood.district_name);
  const district = neighborhood.district_name ? `, ${neighborhood.district_name}` : "";

  return {
    metaTitle: `Houses for Rent in ${neighborhood.name}, Kigali`,
    metaDescription: `Browse homes, apartments, and rentals in ${neighborhood.name}${district}, Kigali. Verified listings, local expertise, and easy viewing bookings with Kigali Rent.`,
    headline: `Properties in ${neighborhood.name}`,
    ...custom,
  };
}
