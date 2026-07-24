import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEX Club",
  description: "Lead-sharing CRM for the NEX Club community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
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
