/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async rewrites() {
    return [
      { source: "/sitemap.xml", destination: "/sitemaps" },
      { source: "/sitemap-pages.xml", destination: "/sitemaps/pages" },
      { source: "/sitemap-areas.xml", destination: "/sitemaps/areas" },
      { source: "/sitemap-properties.xml", destination: "/sitemaps/properties" },
      { source: "/sitemap-blog.xml", destination: "/sitemaps/blog" },
    ];
  },
};

module.exports = nextConfig;
