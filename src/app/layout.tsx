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
      <body>
        <NavBarWrapper />
        <div className="main-content">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
