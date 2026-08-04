/** Fallback avatars — African professionals with medium skin tones. */
export const TESTIMONIAL_AVATARS: Record<string, string> = {
  "aline mukamana": "https://images.unsplash.com/photo-1573497019940-1c056c886f2e?w=200&h=200&fit=crop&crop=face",
  "james carter": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face",
  "patrick niyonzima": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop&crop=face",
};

export function testimonialAvatarUrl(name: string, avatarUrl?: string | null): string {
  if (avatarUrl) return avatarUrl;
  const key = name.trim().toLowerCase();
  return TESTIMONIAL_AVATARS[key] ?? `https://i.pravatar.cc/120?u=${encodeURIComponent(name)}`;
}
