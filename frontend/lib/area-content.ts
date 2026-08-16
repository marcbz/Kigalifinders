import type { NeighborhoodSummary } from "@/lib/areas";

export type AreaSeoContent = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  overview: string[];
  relatedSlugs: string[];
};

const AREA_GUIDES: Record<string, { overview: string[]; relatedSlugs: string[] }> = {
  kibagabaga: {
    overview: [
      "Kibagabaga is a residential Gasabo neighbourhood of family houses, walk-up apartments, and gated compounds. It sits between Kimironko, Remera, and the Convention Centre side of town — practical rather than diplomatic or downtown.",
      "Daily life is straightforward: Kibagabaga Hospital is nearby, motos and buses feed Kimironko and Remera, and Kigali International Community School (KICS) is in the area. Rush hour on the main KG roads can be slow; quality still varies street to street.",
      "It suits families who want space without Nyarutarama prices, professionals working in Gasabo, and expats who need a school run that is not across the city.",
    ],
    relatedSlugs: ["kimironko", "remera", "gisozi", "kacyiru"],
  },
  kimironko: {
    overview: [
      "Kimironko is one of Kigali’s everyday hubs. The market and bus park draw people to shop, change buses, and live within reach of eastern Gasabo — busier and more mixed than the quiet hills.",
      "Housing is apartments and modest family houses more than villas. You live with market noise and junction traffic in exchange for motos, buses, banks, and food on the doorstep. Larger malls are usually a hop toward Remera.",
      "It suits first-time Kigali renters, households that commute locally, and anyone who wants convenience over a silent compound.",
    ],
    relatedSlugs: ["kibagabaga", "remera", "gisozi", "gasabo"],
  },
  gacuriro: {
    overview: [
      "Gacuriro is a hillside Gasabo neighbourhood of newer compounds and, in places, wide views. Vision City has given part of the area a planned, gated feel; outside the estates you still find ordinary hillside houses.",
      "It is residential first: fewer market streets, more access roads. A car or moto is the default for errands and for getting to Kacyiru or Nyarutarama. Some roads are steep in the rain.",
      "It suits families who want a quieter hill and a compound, and who do not need to walk to a market every morning.",
    ],
    relatedSlugs: ["nyarutarama", "gisozi", "kacyiru", "kibagabaga"],
  },
  gisozi: {
    overview: [
      "Gisozi is a lived-in Gasabo neighbourhood, known to visitors for the Kigali Genocide Memorial and to residents for hillside houses, local shops, and roads toward Kibagabaga and Kimironko.",
      "Housing is practical family stock rather than diplomatic villas. Motos cover short hops; drainage and access on the slopes are worth checking in rainy season. Kimironko Market is the usual larger shop.",
      "It suits households looking for ordinary Gasabo housing and people who work across northern Kigali rather than in one office park.",
    ],
    relatedSlugs: ["kibagabaga", "kimironko", "gacuriro", "nyarutarama"],
  },
  nyarutarama: {
    overview: [
      "Nyarutarama is an established upscale Gasabo neighbourhood: leafy streets, larger plots, and the Kigali Golf Club as a landmark. Embassies and international organisations have long shaped who rents here.",
      "Villas and spacious houses are typical, with some gated apartments. It is quieter and usually more expensive than Kimironko. Green Hills Academy is in Nyarutarama; a car is the normal way to run errands.",
      "It suits families and expats with a budget for larger compounds, and professionals who want a residential street rather than a central apartment.",
    ],
    relatedSlugs: ["kacyiru", "kimihurura", "gacuriro", "kibagabaga"],
  },
  gasabo: {
    overview: [
      "Gasabo is a district, not one street. It covers much of northern and eastern Kigali — Nyarutarama, Kibagabaga, Kimironko, Remera, Kacyiru, Kimihurura, Gisozi, Gacuriro, and more.",
      "Housing and daily life change quickly from one sector to the next. Markets, hospitals, offices, and the Convention Centre are all in Gasabo, just not on the same block.",
      "Use this page to compare, then open a specific neighbourhood guide before you lease. “Gasabo” alone is too large a brief.",
    ],
    relatedSlugs: ["kibagabaga", "kimironko", "nyarutarama", "kacyiru", "remera", "kimihurura"],
  },
  kacyiru: {
    overview: [
      "Kacyiru is one of Kigali’s main office neighbourhoods: ministries, public institutions, and a dense weekday workforce. People often live here for the commute, not for hillside quiet.",
      "Apartments and compact houses are common. Days are busy with traffic and parking; evenings are calmer. Kimihurura, Nyarutarama, and Remera are close.",
      "It suits professionals and NGO staff who want to live near work, and expats looking at apartments rather than Nyarutarama villas.",
    ],
    relatedSlugs: ["kimihurura", "nyarutarama", "remera", "kibagabaga"],
  },
  kimihurura: {
    overview: [
      "Kimihurura sits next to Kigali’s diplomatic and conference belt. The Convention Centre and nearby hotels are the skyline; the streets behind them are established, relatively quiet residential compounds.",
      "Furnished apartments and executive houses are a typical brief. You are close to Kacyiru and Nyarutarama; conference days add traffic. It is more formal than Kimironko and more central than Gacuriro.",
      "It suits expats, diplomats, and professionals who want to be near the Convention Centre without living on a market street.",
    ],
    relatedSlugs: ["kacyiru", "nyarutarama", "remera", "kibagabaga"],
  },
  remera: {
    overview: [
      "Remera is a mixed Gasabo neighbourhood around Amahoro Stadium and the roads that feed eastern Kigali. It is busier than Nyarutarama: apartments, family houses, shops, and match-day traffic when the stadium is in use.",
      "Buses and motos are easy. Kimironko Market and the Convention Centre area are close. Living a street off the main road is quieter than living on it.",
      "It suits professionals who want a central Gasabo base and renters who like shops nearby more than a silent compound.",
    ],
    relatedSlugs: ["kimironko", "kibagabaga", "kimihurura", "kacyiru"],
  },
  rebero: {
    overview: [
      "Rebero is a Kicukiro hillside neighbourhood, known for views over southern Kigali and a quieter residential feel than the city centre. Streets climb; plots can feel more open than in Nyarugenge.",
      "Standalone family houses are the usual listing. A car or moto is the realistic default. Commutes into Gasabo offices take planning, especially at peak hours.",
      "It suits households who want a house on a Kicukiro hill, and buyers looking at southern Kigali rather than diplomatic Gasabo.",
    ],
    relatedSlugs: ["kagarama", "kicukiro", "kiyovu"],
  },
  kagarama: {
    overview: [
      "Kagarama is a residential Kicukiro neighbourhood — less famous than Rebero’s views and less central than Kiyovu. It is ordinary southern Kigali: local streets, churches, and compounds.",
      "Family houses and smaller apartments are typical. Many services mean a short trip toward Kicukiro’s main roads. International-school runs, if needed, are usually toward Gasabo.",
      "It suits families and workers based in southern Kigali who want Kicukiro housing without a view-led Rebero brief.",
    ],
    relatedSlugs: ["rebero", "kicukiro", "nyarugenge"],
  },
  kicukiro: {
    overview: [
      "Kicukiro is Kigali’s southern district. The name on a listing can mean the whole district or a more central address — always check the sector. Rebero and Kagarama are the neighbourhood pages most people use next.",
      "Compared with Gasabo it is often more residential and a bit further from the diplomatic and office core: hills, family houses, and growing pockets of apartments.",
      "It suits people who work or have family in southern Kigali, and buyers looking at houses rather than central apartments.",
    ],
    relatedSlugs: ["rebero", "kagarama", "kiyovu", "nyarugenge"],
  },
  kiyovu: {
    overview: [
      "Kiyovu is a central Nyarugenge neighbourhood, close to downtown Kigali. Older houses, renovated homes, and apartments share streets that have been part of the city’s core for a long time.",
      "Some pockets are quiet; others sit near commercial downtown. Motos, buses, and walking cover more of daily life than on the outer hills. Older buildings need a careful look.",
      "It suits people who want to be near downtown and renters who prefer in-town streets to gated suburbs.",
    ],
    relatedSlugs: ["nyarugenge", "nyamirambo", "kacyiru", "rebero"],
  },
  nyamirambo: {
    overview: [
      "Nyamirambo is one of Kigali’s most distinct neighbourhoods: dense, social, and culturally visible, with a large Muslim community and busy commercial streets in southwest Nyarugenge.",
      "Housing is mixed and urban — not a diplomatic-compound market. Food, shops, and community life are the strength; noise on the main streets is the trade-off.",
      "It suits people who want urban Nyarugenge life, households with ties to the area, and renters who prefer a neighbourhood with a clear centre of gravity.",
    ],
    relatedSlugs: ["nyarugenge", "kiyovu", "kicukiro"],
  },
  nyarugenge: {
    overview: [
      "Nyarugenge is Kigali’s historic core district: downtown, Kiyovu, Nyamirambo, and the older commercial city. A listing tagged only “Nyarugenge” still needs a sector.",
      "This is where Kigali feels most like a city centre — offices, shops, older streets — rather than a hillside suburb. Downtown and Nyamirambo are not the same decision.",
      "It suits people who work downtown or who are choosing between Kiyovu and Nyamirambo rather than a Gasabo hill.",
    ],
    relatedSlugs: ["kiyovu", "nyamirambo", "kacyiru", "kicukiro"],
  },
  bugesera: {
    overview: [
      "Bugesera is a district south of Kigali, not a Kigali neighbourhood. People look here for land, houses outside the city, and — in parts of the district — proximity to Bugesera International Airport.",
      "Daily life and commute math are those of a neighbouring district. Confirm the sector, road, utilities, and title; do not treat a Bugesera listing as “still in Kigali.”",
      "It suits buyers looking at land or a home outside the city, and people whose work or family is in Bugesera rather than a Gasabo office.",
    ],
    relatedSlugs: ["kicukiro", "rebero", "gasabo"],
  },
  musanze: {
    overview: [
      "Musanze is in Rwanda’s Northern Province, at the foot of Volcanoes National Park — hours from Kigali, not a suburb. Listings here are a different market from Kacyiru or Remera.",
      "If you need to be in Kigali for work or school, Musanze is a relocation. The Kigali–Musanze road is a journey, not an errand.",
      "It suits people living or investing in northern Rwanda — not a substitute for a Kigali neighbourhood guide.",
    ],
    relatedSlugs: ["gasabo", "nyarutarama", "bugesera"],
  },
  kagugu: {
    overview: [
      "Kagugu is a developing Gasabo residential area on the northern side of Kigali, with newer houses and a more suburban pattern of compounds than the inner neighbourhoods.",
      "A car or moto is the usual way toward Gisozi, Kibagabaga, and the city. Amenities are still catching up with housing; “new” is not the same as well built.",
      "It suits households who want newer Gasabo housing and can live with a longer commute.",
    ],
    relatedSlugs: ["gisozi", "gacuriro", "kibagabaga"],
  },
};

function defaultGuide(name: string, districtName?: string | null) {
  const where = districtName ? `${name} in ${districtName}` : `${name} in Kigali`;
  return {
    overview: [
      `${where} is one of the areas Kigali Rent covers. See the listings below for what is actually available.`,
      "Ask us about the commute from the specific street to your workplace — it varies more than the neighbourhood name suggests.",
    ],
    relatedSlugs: ["gasabo", "kicukiro", "nyarugenge"],
  };
}

export function getAreaSeoContent(neighborhood: NeighborhoodSummary): AreaSeoContent {
  const custom = AREA_GUIDES[neighborhood.slug] ?? defaultGuide(neighborhood.name, neighborhood.district_name);
  const district = neighborhood.district_name ? `, ${neighborhood.district_name}` : "";
  const isHub = ["gasabo", "kicukiro", "nyarugenge"].includes(neighborhood.slug);
  const isOutside = neighborhood.slug === "bugesera" || neighborhood.slug === "musanze";

  const metaTitle = isOutside
    ? `${neighborhood.name} Housing Guide | Kigali Rent`
    : isHub
      ? `${neighborhood.name} District Housing Guide | Kigali Rent`
      : `Living in ${neighborhood.name}, Kigali | Area Guide`;

  const metaDescription = isOutside
    ? `A short guide to housing in ${neighborhood.name}, plus current Kigali Rent listings.`
    : `A short guide to living in ${neighborhood.name}${district}, with current Kigali Rent listings.`;

  const headline = isOutside
    ? `${neighborhood.name} housing`
    : isHub
      ? `${neighborhood.name} district guide`
      : `Living in ${neighborhood.name}`;

  return {
    metaTitle,
    metaDescription,
    headline,
    overview: custom.overview.slice(0, 3),
    relatedSlugs: custom.relatedSlugs,
  };
}
