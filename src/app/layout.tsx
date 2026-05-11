import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBarWrapper from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import GlobalLeadSearch from "@/components/GlobalLeadSearch";
import GlobalSmsDock from "@/components/GlobalSmsDock";

export const metadata: Metadata = {
  title: "Meridian Collective LLC — Partnership Hub",
  description: "Partnership transparency hub for Meridian Collective LLC",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBarWrapper />
        <GlobalLeadSearch />
        <GlobalSmsDock />
        <div className="main-content">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
