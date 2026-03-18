import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian Collective LLC — Operating Agreement Survey",
  description: "Member survey for Meridian Collective LLC operating agreement decisions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
