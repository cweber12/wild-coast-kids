import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
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
  title: "Wild Coast Kids",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-cream font-sans text-dark">
        {children}
      </body>
    </html>
  );
}
