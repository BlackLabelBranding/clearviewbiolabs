import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["500", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const description = "Research materials and peptide catalog for qualified laboratories and researchers. Strictly not for human or animal use.";
  return {
    title: "Clear View Biolabs | Research Materials",
    description,
    openGraph: { title: "Clear View Biolabs", description, images: [{ url: image, width: 1792, height: 937 }] },
    twitter: { card: "summary_large_image", title: "Clear View Biolabs", description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
