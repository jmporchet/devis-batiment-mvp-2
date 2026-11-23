import type { Metadata, Viewport } from "next";
import { UserInvalidAria } from "@/components/user-invalid-aria";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devis chantier",
  description: "Devis structuré à partir de photos et de notes vocales",
  // Suit la taille de texte réglée dans le système (Chrome/Edge 146+).
  other: { "text-scale": "scale" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CH" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900">
        {children}
        <UserInvalidAria />
      </body>
    </html>
  );
}
