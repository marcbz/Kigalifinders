import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Star, Phone, MessageCircle } from "lucide-react";
import { api } from "@/services/api";

export const metadata: Metadata = {
  title: "Our Agents",
  description: "Meet the expert real estate agents at Kigali Rent.",
};

interface Agent {
  id: string;
  name?: string;
  bio?: string;
  years_experience: number;
  rating: number;
  review_count: number;
  properties_sold: number;
  avatar_url?: string;
  phone?: string;
  whatsapp?: string;
}

async function getAgents(): Promise<Agent[]> {
  try {
    const res = await api.get<Agent[]>("/agents");
    return res.data;
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">OUR TEAM</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3">Expert Agents</h1>
          <div className="section-divider mx-auto mt-4" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white dark:bg-card rounded-2xl shadow-lg overflow-hidden border">
              <div className="p-8 text-center">
                <Image
                  src={agent.avatar_url || `https://i.pravatar.cc/120?u=${agent.id}`}
                  alt={agent.name || "Agent"}
                  width={96}
                  height={96}
                  className="rounded-full mx-auto mb-4"
                />
                <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white">{agent.name}</h2>
                <div className="flex items-center justify-center gap-1 text-gold-500 mt-2">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-semibold">{agent.rating}</span>
                  <span className="text-gray-400 text-sm">({agent.review_count} reviews)</span>
                </div>
                <p className="text-gray-500 text-sm mt-4 line-clamp-3">{agent.bio || "Experienced Kigali real estate specialist."}</p>
                <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                  <span>{agent.years_experience}+ yrs</span>
                  <span>{agent.properties_sold} sold</span>
                </div>
                <div className="flex gap-3 mt-6 justify-center">
                  {agent.phone && (
                    <a href={`tel:${agent.phone}`} className="w-10 h-10 rounded-full bg-navy-800 text-gold-500 flex items-center justify-center hover:bg-gold-500 hover:text-white transition">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {agent.whatsapp && (
                    <a href={`https://wa.me/${agent.whatsapp}`} className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <Link href={`/agents/${agent.id}`} className="inline-block mt-6 text-gold-500 font-semibold text-sm hover:underline">
                  View Profile →
                </Link>
              </div>
            </div>
          ))}
        </div>
        {agents.length === 0 && (
          <p className="text-center text-gray-500 py-12">Our agent profiles will appear here once the backend is connected.</p>
        )}
      </div>
    </div>
  );
}
