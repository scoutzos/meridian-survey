import type { Metadata } from "next";
import "./globals.css";
import NavBarWrapper from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Meridian Collective LLC — Partnership Hub",
  description: "Partnership transparency hub for Meridian Collective LLC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBarWrapper />
        {children}
      </body>
    </html>
  );
}
