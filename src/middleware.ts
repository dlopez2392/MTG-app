import { clerkMiddleware } from "@clerk/nextjs/server";

// Allow all routes — auth is optional. Signed-in users get cloud sync,
// guests use localStorage and their data stays on-device only.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
