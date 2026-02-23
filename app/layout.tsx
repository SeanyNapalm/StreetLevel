import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreetLevel",
  description: "StreetLevel — by Seany Napalm",

  icons: {
    // Classic favicon (browser tabs, etc)
    shortcut: "/favicon.ico",

    // Modern favicons
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      // If you add smaller ones later, you can add them here too:
      // { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
      // { url: "/icon-16.png", type: "image/png", sizes: "16x16" },
    ],

    // iOS home screen icon
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },

  // Optional but nice for Android / PWA-style installs
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}