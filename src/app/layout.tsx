import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import "./globals.css";

// The whole page speaks one family; weight (400–900) and italics carry the
// hierarchy, per the coastal-pop-editorial direction in the design brief.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  // Pages set their own titles; the template keeps the brand on every tab.
  title: {
    default: "Wild Coast Kids",
    template: "%s — Wild Coast Kids",
  },
  description:
    "Art classes and a Tuesday outdoor co-op for K–8 kids, rooted in the San Diego coast. Charter fund eligible.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // scroll-pt keeps an anchored section clear of the nav when the browser
    // scrolls to it. Same tokens the nav sets its own height from, so the
    // gap and the bar cannot drift apart.
    <html
      lang="en"
      className={`${montserrat.variable} scroll-pt-nav-sm md:scroll-pt-nav h-full antialiased motion-safe:scroll-smooth`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-cream font-sans text-dark">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
