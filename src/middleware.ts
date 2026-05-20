import { NextRequest, NextResponse } from "next/server";

const productionHost = "campaignscan.nl";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() || "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const isNetlifyPreview = host.endsWith(".netlify.app");

  if (!isLocal && isNetlifyPreview) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = productionHost;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
