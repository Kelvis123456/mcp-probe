import type { Metadata, Viewport } from "next";
import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import { SITE_URL } from "@/lib/content";
import "./globals.css";

const mono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  axes: ["wdth"],
});
const body = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const title = "mcp-probe: scripted checks for MCP servers";
const description =
  "A command-line tool that runs the calls you declare in a YAML file against an MCP server over stdio and exits non-zero when a check fails.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "mcp-probe",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "mcp-probe: one failing check in an otherwise passing run",
      },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edefec" },
    { media: "(prefers-color-scheme: dark)", color: "#111516" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${body.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
