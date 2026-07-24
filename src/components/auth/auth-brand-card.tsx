import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// Shared chrome for the "set a password" auth screens (accept invitation + reset
// password), extracted from the accept-invitation page so the two can't drift.
// Only the heading/subheading and the body (children) differ between screens.
export function AuthBrandCard({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
  return (
    <>
      {/* This card carries its own branded header (the maroon logo bar), so the
          generic app logo the shared auth layout renders above every card is
          hidden while this screen is mounted. The rule lives in the DOM only
          here, so login / register are unaffected. */}
      <style dangerouslySetInnerHTML={{ __html: ".logo{display:none !important;}" }} />
      <Card className="overflow-hidden p-0">
        {/* White logo on the fixed maroon brand colour (#7B1E3A) — same asset the
            invitation email uses. A fixed dark background keeps the white logo
            legible in both light and dark mode. */}
        <div className="bg-[#7B1E3A] px-7 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/email-logo-invitation.png" alt="NEX Club" className="block h-[46px] w-auto" />
        </div>
        <CardContent className="space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{heading}</h1>
            <p className="text-sm text-muted-foreground">{subheading}</p>
          </div>
          {children}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
