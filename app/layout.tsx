import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Cloud Clone",
  description: "A Salesforce-style CRM built on Next.js and Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
