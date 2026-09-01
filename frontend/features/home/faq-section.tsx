import type { FAQ } from "@/types";

export function FAQSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <section id="faq" className="py-20 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">FREQUENTLY ASKED</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">
            Your Questions Answered
          </h2>
          <div className="section-divider mx-auto" />
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.id}
              className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden group"
            >
              <summary className="cursor-pointer list-none p-6 flex justify-between items-center gap-4 font-semibold text-navy-800 dark:text-white [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span
                  className="text-gold-500 text-xl leading-none shrink-0 group-open:hidden"
                  aria-hidden
                >
                  +
                </span>
                <span
                  className="text-gold-500 text-xl leading-none shrink-0 hidden group-open:inline"
                  aria-hidden
                >
                  −
                </span>
              </summary>
              <div
                className="px-6 pb-6 text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4"
                dangerouslySetInnerHTML={{ __html: faq.answer }}
              />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
