export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/funds/:path*", "/arbitrage", "/history", "/settings/:path*"],
};
