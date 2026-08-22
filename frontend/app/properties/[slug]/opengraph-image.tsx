import { ImageResponse } from "next/og";
import { fetchPropertySafe } from "@/lib/server-api";

export const runtime = "nodejs";
export const alt = "Kigali Rent property";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const property = await fetchPropertySafe(slug);

  const title = property?.title || "Kigali Rent listing";
  const location =
    property?.neighborhood_name || property?.district_name
      ? [property.neighborhood_name, property.district_name].filter(Boolean).join(", ")
      : "Kigali, Rwanda";
  const price =
    property != null
      ? `${property.currency || "USD"} ${Math.round(property.price).toLocaleString()}${
          property.listing_type !== "sale" && property.price_period
            ? `/${property.price_period === "month" ? "mo" : property.price_period}`
            : ""
        }`
      : "";
  const imageUrl = property?.primary_image || null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#06132b",
          color: "#faf7f2",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 4,
                color: "#c9a961",
                fontFamily: "sans-serif",
                fontWeight: 600,
              }}
            >
              KIGALI RENT
            </div>
            <div style={{ fontSize: 54, lineHeight: 1.1, fontWeight: 700, maxWidth: 620 }}>
              {title.length > 70 ? `${title.slice(0, 67)}…` : title}
            </div>
            <div style={{ fontSize: 26, color: "#d1d5db", fontFamily: "sans-serif" }}>{location}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {price ? (
              <div style={{ fontSize: 36, color: "#c9a961", fontWeight: 700 }}>{price}</div>
            ) : null}
            <div style={{ fontSize: 20, color: "#9ca3af", fontFamily: "sans-serif" }}>
              kigalirent.com
            </div>
          </div>
        </div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={520}
            height={630}
            style={{
              width: 520,
              height: 630,
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 520,
              height: 630,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0a1e3f",
              color: "#c9a961",
              fontSize: 28,
              fontFamily: "sans-serif",
            }}
          >
            Property listing
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
