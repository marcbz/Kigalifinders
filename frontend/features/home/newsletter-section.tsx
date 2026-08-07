"use client";

export function NewsletterSection() {
  return (
    <section className="py-16 px-6 bg-cream dark:bg-secondary">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="font-serif text-3xl font-bold text-navy-800 dark:text-white mb-3">Get Property Alerts</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Be the first to know about new listings and exclusive opportunities.</p>
        <form className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Your email address" className="lux-input flex-1" required />
          <button type="submit" className="btn-gold px-8 py-3.5 rounded-md font-semibold whitespace-nowrap">Subscribe</button>
        </form>
      </div>
    </section>
  );
}
