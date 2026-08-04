/** Stock portrait photos — generic faces, not celebrities. */
export const TESTIMONIAL_AVATARS: Record<string, string> = {
  "aline mukamana":
    "https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
  "james carter":
    "https://images.unsplash.com/photo-1619895862022-09114b41f16a?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
  "patrick niyonzima":
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
};

export function testimonialAvatarUrl(name: string, avatarUrl?: string | null): string {
  const key = name.trim().toLowerCase();
  if (TESTIMONIAL_AVATARS[key]) return TESTIMONIAL_AVATARS[key];
  if (avatarUrl) return avatarUrl;
  return `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces&auto=format&q=80&u=${encodeURIComponent(name)}`;
}
