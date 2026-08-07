"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { FAQ } from "@/types";

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
