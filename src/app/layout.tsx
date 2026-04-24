import type { Metadata } from "next";
import "./globals.css";
import NavBarWrapper from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Meridian Collective LLC — Partnership Hub",
  description: "Partnership transparency hub for Meridian Collective LLC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <NavBarWrapper />
        <div className="main-content">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
