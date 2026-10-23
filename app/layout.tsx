import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Execfind — Lead Enricher",
  description: "Evidence-backed enrichment for one B2B company at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
