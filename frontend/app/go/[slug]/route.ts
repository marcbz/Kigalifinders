import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeSlug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const forward = [
    "user-agent",
    "referer",
    "x-forwarded-for",
    "x-real-ip",
    "cf-ipcountry",
    "cf-ipcity",
    "cf-region",
    "x-vercel-ip-country",
    "x-vercel-ip-city",
    "x-vercel-ip-country-region",
  ];
  for (const name of forward) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  try {
    const res = await fetch(`${API_URL}/go/${encodeURIComponent(safeSlug)}`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    const data = (await res.json()) as { destination_url?: string };
    if (!data.destination_url) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.redirect(data.destination_url, 302);
  } catch {
    return new NextResponse("Redirect unavailable", { status: 503 });
  }
}
