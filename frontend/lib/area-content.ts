import type { NeighborhoodSummary } from "@/lib/areas";

export type AreaSeoContent = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  overview: string[];
  propertyTypes: string;
  pros: string[];
  cons: string[];
  transport: string;
  amenities: string;
  schools: string;
  bestFor: string;
  relatedSlugs: string[];
};

const AREA_GUIDES: Record<string, Omit<AreaSeoContent, "metaTitle" | "metaDescription" | "headline">> = {
  kibagabaga: {
    overview: [
      "Kibagabaga sits in Gasabo, northeast of the city centre, on a ridge of residential streets that have filled in steadily over the last decade. It is neither a diplomatic compound nor a downtown block: most housing is family houses, walk-up apartments, and newer gated compounds along KG roads.",
      "People choose it because daily life is practical. You can reach Remera, Kimironko Market, and the Kigali Convention Centre area without crossing the whole city, and the neighbourhood still feels residential after dark.",
    ],
    propertyTypes: "Listings here are usually standalone houses and mid-size apartments. Two- and three-bedroom homes are the most common ask; furnished units show up for relocations. Plots appear less often than in outer Gasabo.",
    pros: [
      "Everyday services nearby, including Kibagabaga Hospital",
      "Mix of houses and apartments at a wider spread of rents than Nyarutarama",
      "Straightforward road links toward Remera and Kimironko",
    ],
    cons: [
      "Rush-hour traffic on the main KG corridors can be slow",
      "Quality varies street to street — always view the compound, not just photos",
    ],
    transport: "Most residents use private cars, motos, or buses feeding Kimironko and Remera. Commutes to Kacyiru or the Convention Centre are short on a clear road; plan extra time at peak hours.",
    amenities: "Kibagabaga Hospital is the local landmark for healthcare. Groceries, pharmacies, and small restaurants sit along the main roads; larger shopping is usually Kimironko Market or malls toward Remera.",
    schools: "Kigali International Community School (KICS) is in Kibagabaga and is a common reason families look here. Confirm fees, curriculum, and the current campus address directly with the school before you sign a lease around it.",
    bestFor: "Families who want space without going fully upscale, professionals working in Gasabo, and expats who need a school commute that is not across town.",
    relatedSlugs: ["kimironko", "remera", "gisozi", "kacyiru"],
  },
  kimironko: {
    overview: [
      "Kimironko is one of Kigali’s most used everyday neighbourhoods. The market and bus park make it a hub: people come here to shop, change buses, and live within reach of both Gasabo offices and the eastern side of the city.",
      "Housing is mixed and busy. You will see older houses behind the market streets, newer apartments on the hills, and a lot of practical rentals rather than showpiece villas.",
    ],
    propertyTypes: "Expect apartments and modest family houses more than large villas. One- to three-bedroom units are typical. Furnished stock exists but is less “executive compound” than Kimihurura or Nyarutarama.",
    pros: [
      "Kimironko Market and bus park — the strongest amenity cluster in this part of Gasabo",
      "Usually more price options than diplomatic neighbourhoods",
      "Easy to get a moto or bus without planning a long trip",
    ],
    cons: [
      "Noise and congestion near the market and main junctions",
      "Parking and compound privacy vary widely",
    ],
    transport: "This is a transfer point. City buses and motos are dense around the market. Driving to Remera, Kibagabaga, or Kacyiru is routine; the bottleneck is local traffic, not distance.",
    amenities: "The market is the centre of daily shopping. Banks, pharmacies, small eateries, and mobile-money shops cluster around it. For larger supermarkets or malls, residents often continue toward Remera.",
    schools: "There are many nearby government and private schools in Gasabo; choices depend on the exact street. Do not assume a school from a listing title — visit and confirm catchment, language of instruction, and fees.",
    bestFor: "People who want convenience and transport, first-time Kigali renters, and households that shop and commute locally rather than living in a quiet enclave.",
    relatedSlugs: ["kibagabaga", "remera", "gisozi", "gasabo"],
  },
  gacuriro: {
    overview: [
      "Gacuriro is a hillside Gasabo neighbourhood known for newer residential compounds and, in places, wide views. Vision City sits in this part of Kigali and has shaped how people talk about the area: planned streets, gated living, and a more suburban feel than Kimironko.",
      "Outside the planned estates, you still find ordinary hillside houses. The character is residential first — fewer market streets, more compounds and access roads.",
    ],
    propertyTypes: "Modern houses and apartments in gated communities are the usual search. Three- and four-bedroom family homes are common in listings. Some stock is newer construction compared with inner Kiyovu.",
    pros: [
      "Quieter residential streets than market neighbourhoods",
      "Newer compounds and, in parts of the area, planned estate living",
      "Hill views on higher plots",
    ],
    cons: [
      "You will likely need a car or moto for most errands",
      "Steep access roads in the rain",
    ],
    transport: "Residents typically drive or take motos toward Kacyiru, Nyarutarama, and the city. Public buses are thinner than in Remera or Kimironko. Budget commute time if you work downtown every day.",
    amenities: "Daily shops exist along the main access roads. Many households still go to larger retail in Nyarutarama, Kacyiru, or malls closer to Remera. Treat “nearby supermarket” in ads as something to verify on a viewing.",
    schools: "Families often look at private schools in northern Gasabo, including options around Gacuriro such as Riviera High School — confirm the campus and fees yourself. International-school commutes toward Nyarutarama or Kibagabaga are a regular part of the decision.",
    bestFor: "Families who want a compound and a quieter hill, and renters who do not need to walk to a market every morning.",
    relatedSlugs: ["nyarutarama", "gisozi", "kacyiru", "kibagabaga"],
  },
  gisozi: {
    overview: [
      "Gisozi is a Gasabo neighbourhood most visitors first know because of the Kigali Genocide Memorial. Around that, it is a lived-in residential area of houses on slopes, local shops, and roads that connect toward Kibagabaga, Kimironko, and the city.",
      "It is less “showcase Kigali” than Nyarutarama and less of a transport hub than Kimironko. Housing tends to be practical family stock.",
    ],
    propertyTypes: "Standalone houses and simple apartments dominate. Bedroom counts in listings are often two to four. Sale plots and houses appear alongside rentals.",
    pros: [
      "Residential feel with access toward several Gasabo neighbourhoods",
      "Often more reachable price points than diplomatic quarters",
      "The memorial area is well known and easy to locate for first-time visitors",
    ],
    cons: [
      "Hills and uneven roads — check drainage and access in rainy season",
      "Fewer destination restaurants than Kacyiru or Kimihurura",
    ],
    transport: "Motos are the default for short hops. Buses run on the main roads toward Kimironko and the city. A car helps if you regularly cross to Kicukiro or Nyarugenge.",
    amenities: "Local shops, churches, and small clinics serve the streets. For a full weekly shop, many people continue to Kimironko Market. The Genocide Memorial is the main civic landmark.",
    schools: "Local primary and secondary schools serve Gisozi; international schools are a commute (Kibagabaga or Nyarutarama, depending on the school). Always verify the actual school gate from the house you are viewing.",
    bestFor: "Households looking for ordinary Gasabo housing, and people who work across northern Kigali rather than in a single office park.",
    relatedSlugs: ["kibagabaga", "kimironko", "gacuriro", "nyarutarama"],
  },
  nyarutarama: {
    overview: [
      "Nyarutarama is one of Kigali’s established upscale residential neighbourhoods: leafy streets, larger plots, and the Kigali Golf Club as a long-standing landmark. Embassies and international organisations have historically clustered in and around this part of Gasabo, which still shapes who rents here.",
      "The housing stock is villas, large family houses, and some apartment compounds. It is quieter than Remera and more expensive, on average, than Kimironko — though you should still judge by the specific street and compound.",
    ],
    propertyTypes: "Villas and spacious houses are the stereotype, with some gated apartments. Three bedrooms and up are typical in advertised family homes. Furnished executive rentals appear for diplomatic and NGO contracts.",
    pros: [
      "Quiet, residential streets and larger compounds",
      "Kigali Golf Club and a reputation for security-conscious housing",
      "Short hops to Kacyiru offices and Green Hills Academy",
    ],
    cons: [
      "Rents and sale prices are usually at the high end of Kigali",
      "Daily errands often mean a car; it is not a market neighbourhood",
    ],
    transport: "Private cars are common. Motos work for short trips to Kacyiru or Gacuriro. Peak traffic toward the city still applies. Buses exist on main roads but are not the reason people live here.",
    amenities: "Restaurants and small retail sit along the main Nyarutarama roads. Golf club membership is separate from renting nearby. For a big shop, residents use malls and supermarkets in greater Gasabo rather than a single local market.",
    schools: "Green Hills Academy is in Nyarutarama and is a frequent reason families search this neighbourhood. Other international schools (for example KICS in Kibagabaga) are a short drive — confirm current locations and admissions yourself.",
    bestFor: "Families and expats with a housing budget for larger compounds, and professionals who want a residential street rather than a central apartment.",
    relatedSlugs: ["kacyiru", "kimihurura", "gacuriro", "kibagabaga"],
  },
  gasabo: {
    overview: [
      "Gasabo is a district, not a single street. It covers a large share of Kigali’s north and east: Nyarutarama, Kibagabaga, Kimironko, Remera, Kacyiru, Kimihurura, Gisozi, Gacuriro, and more. Searching “Gasabo” is useful when you are still choosing a neighbourhood, not when you already know the hill you want.",
      "Housing, rents, and daily life change quickly from one sector to the next. Use the neighbourhood guides below rather than treating the whole district as one market.",
    ],
    propertyTypes: "Across Gasabo you will see everything KigaliRent lists: apartments in Remera, villas in Nyarutarama, family houses in Kibagabaga, market-side rentals in Kimironko. Filter by neighbourhood once you know your commute.",
    pros: [
      "Widest mix of neighbourhood types in Kigali",
      "Contains both diplomatic/residential hills and busy market hubs",
      "Most of the city’s international-school options sit in this district",
    ],
    cons: [
      "Too large to pick a home from the district name alone",
      "Commute times inside Gasabo still vary a lot",
    ],
    transport: "Main corridors link Remera, Kimironko, Kacyiru, and the Convention Centre. Your daily trip depends entirely on which sector you pick. Read the specific area page for the streets that matter.",
    amenities: "Markets (Kimironko), hospitals (including Kibagabaga Hospital), offices (Kacyiru), and the Convention Centre (Kimihurura) are all in Gasabo — just not on the same block.",
    schools: "International and private schools used by expats are concentrated in Gasabo (Nyarutarama, Kibagabaga, and nearby). Government schools are throughout. Choose the neighbourhood first, then the school run.",
    bestFor: "Anyone still comparing Kigali neighbourhoods, and renters whose office is in Gasabo but who have not fixed a sector yet.",
    relatedSlugs: ["kibagabaga", "kimironko", "nyarutarama", "kacyiru", "remera", "kimihurura"],
  },
  kacyiru: {
    overview: [
      "Kacyiru is one of Kigali’s main office neighbourhoods: ministries, public institutions, and a dense weekday workforce. Housing here is often chosen for the commute — apartments and compact houses within a short drive of work — not for hillside quiet.",
      "Evenings and weekends are calmer than the working day. Streets mix compounds, small commercial buildings, and residential pockets toward Kimihurura and Nyarutarama.",
    ],
    propertyTypes: "Apartments and townhouse-style homes are common. One- and two-bedroom units suit singles and couples; larger houses exist off the main office roads. Furnished stock is aimed at short-notice professional relocations.",
    pros: [
      "Short commute to many government and NGO offices",
      "Services aimed at weekday workers: banks, lunch spots, pharmacies",
      "Easy to reach Kimihurura, Nyarutarama, and Remera",
    ],
    cons: [
      "Daytime traffic and parking pressure",
      "Less of a “neighbourhood evening life” than Nyamirambo or Kimironko Market",
    ],
    transport: "This is a commute destination as much as a home base. Buses and motos are plentiful on the main roads. If you work in Kacyiru, living here or in adjacent Kimihurura/Nyarutarama cuts a lot of wasted time.",
    amenities: "Office-area cafes, banks, and shops. Larger leisure and retail often sit toward the Convention Centre, Remera, or Nyarutarama. Do not expect a single central market like Kimironko.",
    schools: "Some private schools serve this part of Gasabo; many families still commute to Nyarutarama or Kibagabaga campuses. Check the school run from the exact compound, not from the Kacyiru name on a map.",
    bestFor: "Professionals and NGO staff who want to live near work, and expats on a housing budget that fits apartments more than Nyarutarama villas.",
    relatedSlugs: ["kimihurura", "nyarutarama", "remera", "kibagabaga"],
  },
  kimihurura: {
    overview: [
      "Kimihurura sits next to Kigali’s diplomatic and conference belt. The Kigali Convention Centre and nearby hotels are the skyline most people recognise. The residential streets behind that are established, relatively quiet, and popular with people on institutional housing allowances.",
      "It feels more formal than Kimironko and more central than Gacuriro. Compounds are often walled; streets are used to embassy and NGO traffic.",
    ],
    propertyTypes: "Furnished apartments, executive houses, and gated compounds. Two- and three-bedroom furnished units are a typical brief. Long leases for organisations are common.",
    pros: [
      "Next to the Convention Centre, hotels, and a concentration of offices",
      "Established residential streets with a diplomatic-area reputation",
      "Short drive to Kacyiru and Nyarutarama",
    ],
    cons: [
      "Pricing often tracks expat and organisational budgets",
      "Conference traffic on event days",
    ],
    transport: "Cars and motos cover the short distances to Kacyiru, Remera, and the Convention Centre. It is not a bus-park neighbourhood. Airport runs are a known taxi/moto route across town — time them; do not assume they are short.",
    amenities: "Hotels, restaurants, and conference services cluster around the Convention Centre. For a weekly food shop, residents use supermarkets in the wider Gasabo area. Evening options are stronger here than in purely residential hills.",
    schools: "Families often combine Kimihurura housing with schools in Nyarutarama or Kibagabaga. There is no single “Kimihurura school” that defines the market — verify the commute.",
    bestFor: "Expats, diplomats, and professionals who want to be near the Convention Centre and Kacyiru without living on a market street.",
    relatedSlugs: ["kacyiru", "nyarutarama", "remera", "kibagabaga"],
  },
  remera: {
    overview: [
      "Remera is a well-known Gasabo neighbourhood around Amahoro Stadium and the roads that feed the eastern side of the city. It is busier and more mixed-use than Nyarutarama: apartments, family houses, shops, and match-day traffic when the stadium is in use.",
      "It is a practical place to live if you want Gasabo access without committing to a quiet hill. Kimironko, Kibagabaga, and Kimihurura are all close on the map.",
    ],
    propertyTypes: "Apartments and family houses. One- to three-bedroom rentals are the volume of the market. Some furnished units target people who work near the stadium, offices, or NGOs in adjacent sectors.",
    pros: [
      "Central Gasabo location with Amahoro Stadium as a clear landmark",
      "More urban convenience than the outer hills",
      "Easy to reach Kimironko Market and the Convention Centre area",
    ],
    cons: [
      "Noise and congestion on stadium and event days",
      "Main-road compounds can be dusty and busy",
    ],
    transport: "One of the easier Gasabo neighbourhoods for buses and motos. The main roads connect toward the city, Kimironko, and Kacyiru. Living a street off the highway is quieter than living on it.",
    amenities: "Shops, pharmacies, and eateries along the main roads. The stadium dominates the mental map. Kimironko Market is the usual large-market trip. Hotels and the Convention Centre are a short hop toward Kimihurura.",
    schools: "Local schools serve Remera; international-school families often still commute to Kibagabaga or Nyarutarama. Measure that drive at school-run hours before you sign.",
    bestFor: "Professionals who want a central Gasabo base, people who use buses, and renters who like being near shops more than a silent compound.",
    relatedSlugs: ["kimironko", "kibagabaga", "kimihurura", "kacyiru"],
  },
  rebero: {
    overview: [
      "Rebero is a Kicukiro hillside neighbourhood, known locally for views over southern Kigali and a quieter residential texture than the city centre. Streets climb; plots can feel more open than in Nyarugenge.",
      "It is still inside Kigali, not a satellite town. Commutes into town are a daily calculation, especially if you work in Gasabo.",
    ],
    propertyTypes: "Standalone houses are the usual listing, including family homes with gardens. Apartments appear too. Sale listings (houses and plots) show up more often in Kicukiro searches than in inner Nyarutarama.",
    pros: [
      "Hillside setting and, on higher plots, wide views",
      "More residential calm than Remera or Kimironko Market",
      "Kicukiro access toward Kagarama and the rest of the district",
    ],
    cons: [
      "Steep roads and longer trips to Gasabo offices",
      "Fewer walkable amenities than central neighbourhoods",
    ],
    transport: "A car or reliable moto is the realistic default. Buses exist on main Kicukiro roads but frequencies and last-mile walks matter. Time a commute to Kacyiru or downtown before you decide.",
    amenities: "Local shops on the access roads. Larger retail and services are usually a trip toward Kicukiro centre or across to Gasabo malls. Do not assume a supermarket at the gate.",
    schools: "Kicukiro has public and private schools; international campuses are more often in Gasabo. Families sometimes accept a cross-city school run in exchange for a house and a view — that trade-off should be tested in traffic.",
    bestFor: "Households who want a house on a hill in Kicukiro, and buyers looking at southern Kigali rather than diplomatic Gasabo.",
    relatedSlugs: ["kagarama", "kicukiro", "kiyovu"],
  },
  kagarama: {
    overview: [
      "Kagarama is a residential Kicukiro neighbourhood — less famous than Rebero’s views and less central than Kiyovu. It is the kind of area people consider when they want a house in southern Kigali at a more everyday scale.",
      "Daily life is local streets, churches, and compounds, with errands toward Kicukiro’s main roads.",
    ],
    propertyTypes: "Family houses and smaller apartments. Listings may include modest rentals and the occasional sale. Bedroom mixes follow ordinary family demand more than executive furnished stock.",
    pros: [
      "Residential Kicukiro without being a tourist-facing hillside brand",
      "Often considered for more reachable rents than Nyarutarama",
      "Neighbours Rebero if you want to stay in the same district",
    ],
    cons: [
      "Fewer landmark amenities of its own",
      "You will travel for many services and for most Gasabo jobs",
    ],
    transport: "Motos and private cars. Plan the commute to your actual workplace; Kicukiro to Kacyiru is a real trip at peak hours. Buses on district roads are useful if you live near them.",
    amenities: "Small shops and local services. For markets and larger stores, residents typically leave the immediate streets. Treat listing copy about “nearby everything” as a viewing checklist.",
    schools: "Local Kicukiro schools are the default. International-school families should map the drive to Gasabo campuses. There is no widely known international campus that defines Kagarama the way KICS defines Kibagabaga.",
    bestFor: "Families and workers based in southern Kigali, and renters who want Kicukiro housing without paying for a view-led Rebero brief.",
    relatedSlugs: ["rebero", "kicukiro", "nyarugenge"],
  },
  kicukiro: {
    overview: [
      "Kicukiro is the southern district of Kigali. The name on a listing can mean the district as a whole or a more central Kicukiro address — always check the sector. Rebero and Kagarama are the neighbourhood pages most renters use next.",
      "Compared with Gasabo, Kicukiro is often discussed as more residential and a bit further from the diplomatic/office core, with hills, family houses, and growing pockets of apartments.",
    ],
    propertyTypes: "Houses, apartments, and sale plots. Family-sized homes are the typical search. Furnished executive stock is thinner than in Kimihurura.",
    pros: [
      "Residential hills and a different price conversation than Nyarutarama",
      "Room for houses and gardens compared with dense inner Nyarugenge",
      "Clear sub-areas (Rebero, Kagarama) once you zoom in",
    ],
    cons: [
      "Longer commutes to many Gasabo offices",
      "The district name alone is too vague for a lease decision",
    ],
    transport: "Main roads connect toward the city and the airport side of Kigali. Your trip time depends on the sector. Test peak hours if you work in Kacyiru or downtown.",
    amenities: "Kicukiro has its own shops, schools, and local centres. Big-box retail and nightlife are still often a trip. Use the Rebero or Kagarama guide for street-level detail.",
    schools: "District public and private schools throughout. International schools are more concentrated in Gasabo, so school-run planning is part of choosing Kicukiro.",
    bestFor: "People who work or have family in southern Kigali, and buyers looking at houses rather than central apartments.",
    relatedSlugs: ["rebero", "kagarama", "kiyovu", "nyarugenge"],
  },
  kiyovu: {
    overview: [
      "Kiyovu is a central Nyarugenge neighbourhood, close to downtown Kigali. Older houses, renovated homes, and apartments share streets that have been part of the city’s core for a long time. It feels more “in town” than Gasabo’s hills.",
      "Some pockets are quiet residential; others sit near commercial downtown. The difference between a side street and a main road is large — view at the hour you would actually live there.",
    ],
    propertyTypes: "Character houses, renovated homes, and apartments. Sizes range from compact in-town units to larger older houses. Furnished apartments appear for people who want to be near the centre.",
    pros: [
      "Close to downtown Nyarugenge",
      "Walkable in parts, unlike most Kigali hills",
      "Older housing stock with more variation than a new gated estate",
    ],
    cons: [
      "Traffic, noise, and parking on busier streets",
      "Some older buildings need a careful inspection",
    ],
    transport: "This is one of the better in-town bases. Motos, buses, and walking cover more of daily life than in Gacuriro. Cross-city trips to Kibagabaga still take time, but you start from the centre.",
    amenities: "Downtown shops, banks, restaurants, and services are the point of living here. You are not dependent on a single neighbourhood market. For a large fresh market, people still go to places like Kimironko when they need to.",
    schools: "Central Kigali has a mix of schools; Lycée de Kigali is a well-known public school in Nyarugenge (Nyanza area — confirm the campus relative to the house). International schools remain a Gasabo commute for many families.",
    bestFor: "People who want to be near downtown, professionals who dislike a long hill commute, and renters who prefer in-town streets to gated suburbs.",
    relatedSlugs: ["nyarugenge", "nyamirambo", "kacyiru", "rebero"],
  },
  nyamirambo: {
    overview: [
      "Nyamirambo is one of Kigali’s most distinct neighbourhoods: dense, social, and culturally visible, with a large Muslim community, busy commercial streets, and a night-time energy you will not find in Nyarutarama. It sits in Nyarugenge, southwest of the downtown core.",
      "Housing is mixed and urban. This is not a diplomatic compound market. People live here for community, food, and a city feel — or because they already have family ties to the area.",
    ],
    propertyTypes: "Town houses, apartments, and rooms in denser fabric. Listings may be smaller than Gasabo family villas. Always clarify what “house” means on the ground.",
    pros: [
      "Strong local identity, restaurants, and street life",
      "More central than outer Kicukiro hills",
      "Community institutions (including mosques) that structure daily life",
    ],
    cons: [
      "Noise and crowding on the main streets",
      "Not the usual brief for quiet expat compounds",
    ],
    transport: "Motos and buses are part of the street. Downtown Nyarugenge is closer than from Rebero. If you work in northern Gasabo, treat the commute as a real cross-city trip.",
    amenities: "Food, shops, tailors, and local services are the strength. Nyamirambo Women’s Center is a known community organisation in the area. This is not a mall neighbourhood; it is a street neighbourhood.",
    schools: "Local schools including faith-based options. International-school families usually commute out. Match the school to the household, not to a tourism description of Nyamirambo.",
    bestFor: "People who want urban Nyarugenge life, households with ties to the area, and renters who prefer a neighbourhood with a clear cultural centre of gravity.",
    relatedSlugs: ["nyarugenge", "kiyovu", "kicukiro"],
  },
  nyarugenge: {
    overview: [
      "Nyarugenge is Kigali’s historic core district: downtown, Kiyovu, Nyamirambo, and the older commercial city. A listing tagged only “Nyarugenge” still needs a sector. Downtown living and Nyamirambo living are not the same decision.",
      "This district is where Kigali feels most like a city centre — offices, shops, older streets — rather than a hillside suburb.",
    ],
    propertyTypes: "Apartments, older houses, and mixed commercial-residential buildings. Furnished in-town units exist. Large new villas are more of a Gasabo/Kicukiro story.",
    pros: [
      "Closest district to downtown functions",
      "Kiyovu and Nyamirambo give two very different residential options",
      "Better chance of walking some errands than on the outer hills",
    ],
    cons: [
      "Congestion and noise in the commercial core",
      "The district label hides big differences between sectors",
    ],
    transport: "The city’s central roads, bus routes, and moto density are here. Gasabo jobs still require a planned commute. Living in Nyarugenge helps if your life is downtown-shaped.",
    amenities: "Banks, shops, restaurants, and public services concentrate in the core. Use the Kiyovu or Nyamirambo page for a street-level picture.",
    schools: "Nyarugenge includes well-known schools such as Lycée de Kigali (confirm campus). Many international schools remain in Gasabo.",
    bestFor: "People who work downtown, want in-town housing, or are comparing Kiyovu versus Nyamirambo rather than picking a Gasabo hill.",
    relatedSlugs: ["kiyovu", "nyamirambo", "kacyiru", "kicukiro"],
  },
  bugesera: {
    overview: [
      "Bugesera is a district south of Kigali, not a Kigali neighbourhood. People look here for land, houses outside the city, and — increasingly — because of Bugesera International Airport, Rwanda’s new main airport project in the district.",
      "Daily life, services, and commute math are those of a neighbouring district, not of Kibagabaga or Kacyiru. Do not treat a Bugesera listing as “still in Kigali” without checking the actual sector and road.",
    ],
    propertyTypes: "Land and houses are the usual search, including sale plots. Urban apartment stock like Remera is not the default. Confirm utilities, access roads, and title on every plot.",
    pros: [
      "Space and land compared with inner Kigali",
      "Airport-related interest in parts of the district — still verify the exact location",
      "Quieter than central Kigali neighbourhoods",
    ],
    cons: [
      "You are outside Kigali for most city jobs and schools",
      "Services and public transport are not inner-city density",
    ],
    transport: "The road to Kigali is the commute. Time it at the hour you would travel. The new airport changes access in the district over time; a listing’s distance to the airport should be checked on a map, not taken from marketing copy.",
    amenities: "Town centres in Bugesera serve local needs. Kigali remains the trip for many specialised services. Ask what is actually walkable from the plot.",
    schools: "Local schools in Bugesera. Kigali international schools imply a long school run or boarding — be honest about that before you buy land “for the family.”",
    bestFor: "Buyers looking at land or a home outside Kigali, and people whose work or family is in Bugesera rather than a Gasabo office.",
    relatedSlugs: ["kicukiro", "rebero", "gasabo"],
  },
  musanze: {
    overview: [
      "Musanze is in Rwanda’s Northern Province, at the foot of the Volcanoes National Park — hours from Kigali, not a Kigali suburb. Listings here are a different market: town housing, land, and property tied to tourism and local life in Musanze, not a Kacyiru commute.",
      "If you need to be in Kigali for work or school, Musanze is a relocation, not a neighbourhood swap.",
    ],
    propertyTypes: "Town houses, land, and locally oriented homes. Do not expect the same apartment inventory as Remera. Title, access, and intended use (residence vs tourism) need a careful check.",
    pros: [
      "Gateway to Volcanoes National Park and northern Rwanda",
      "A full town with its own market and services",
      "Different climate and setting from Kigali’s hills",
    ],
    cons: [
      "Not a Kigali commute",
      "KigaliRent’s Musanze inventory may be thin compared with Gasabo",
    ],
    transport: "The Kigali–Musanze road is the link. Buses and private cars make the trip; it is a journey, not an errand. Local transport in Musanze is separate from Kigali’s moto network.",
    amenities: "Musanze town has shops, hotels, and services for residents and visitors. Kigali remains the capital for many specialised needs.",
    schools: "Local schools in Musanze. International Kigali schools are not a daily option from here.",
    bestFor: "People living or investing in northern Rwanda, and anyone whose life is in Musanze — not a substitute for a Kigali neighbourhood guide.",
    relatedSlugs: ["gasabo", "nyarutarama", "bugesera"],
  },
  kagugu: {
    overview: [
      "Kagugu is a developing Gasabo residential area on the northern side of Kigali. It attracts people looking for newer houses and a bit more space than the inner neighbourhoods, with a more suburban pattern of compounds and access roads.",
    ],
    propertyTypes: "Newer houses and some apartments. Family-sized homes are the usual brief. Confirm finishing quality — “new” is not the same as “well built.”",
    pros: ["Room to grow compared with inner Gasabo", "Residential, less market-noise than Kimironko"],
    cons: ["Longer trips for many jobs and international schools", "Amenities still catching up with housing"],
    transport: "Car or moto toward Gisozi, Kibagabaga, and the city. Buses are thinner than at Kimironko.",
    amenities: "Local shops on the main access roads. Larger retail is a trip into more established Gasabo neighbourhoods.",
    schools: "Local schools plus a commute to better-known Gasabo campuses. Map the school run before you lease.",
    bestFor: "Households who want newer Gasabo housing and can live with a longer commute.",
    relatedSlugs: ["gisozi", "gacuriro", "kibagabaga"],
  },
};

function defaultGuide(name: string, districtName?: string | null): Omit<AreaSeoContent, "metaTitle" | "metaDescription" | "headline"> {
  const where = districtName ? `${name} in ${districtName}` : `${name} in Kigali`;
  return {
    overview: [
      `${where} is one of the areas Kigali Rent covers. Use current listings below for prices and property types — we do not invent a market average when we do not have enough local data on this page.`,
    ],
    propertyTypes: "See the current Kigali Rent listings on this page for houses, apartments, or land actually available right now.",
    pros: ["Listed and viewable through Kigali Rent", "Local viewing support"],
    cons: ["This page has less neighbourhood detail until we have more on-the-ground notes"],
    transport: "Ask us about the commute from this area to your workplace; it depends on the exact street.",
    amenities: "We only list amenities we can stand behind. For this area, start with a viewing and the map around the compound.",
    schools: "Confirm schools from the specific house — names on the internet go stale.",
    bestFor: "People already considering this area who want to see live Kigali Rent inventory.",
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
    ? `What ${neighborhood.name} housing is actually like, who it suits, and current Kigali Rent listings — not a Kigali neighbourhood substitute.`
    : `A practical guide to ${neighborhood.name}${district}: housing, transport, schools we can name, and current Kigali Rent rentals and homes.`;

  const headline = isOutside
    ? `${neighborhood.name} housing`
    : isHub
      ? `${neighborhood.name} district guide`
      : `Living in ${neighborhood.name}`;

  return {
    metaTitle,
    metaDescription,
    headline,
    ...custom,
  };
}
