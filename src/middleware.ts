import NextAuth from "next-auth";
import { edgeAuthConfig } from "~/server/auth/edge-config";

const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/builder")) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/builder/:path*"],
};
