import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ram Prasad CRM — Defence Contract Consultancy",
  description: "One requirement, one record, one timeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
