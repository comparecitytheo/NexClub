import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Exposed as a CSS variable rather than a bare className so the stylesheet can
// append an emoji fallback after it. Manrope has no emoji glyphs, and without an
// explicit fallback some platforms (notably Windows and Linux) render tofu boxes
// instead of falling through to a colour emoji font.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "NEX Club",
  description: "Lead-sharing CRM for the NEX Club community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.variable}>
        {/* Pre-paint: restore the collapsed-sidebar state before React hydrates
            so there is no flash on refresh. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('sidebar-collapsed')==='1'){document.documentElement.classList.add('sidebar-collapsed')}}catch(e){}})()`,
          }}
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
