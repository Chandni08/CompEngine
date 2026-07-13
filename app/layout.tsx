import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waters NextGen Competitive Engine",
  description: "Competitive intelligence dashboard for Waters Next Gen LC product strategy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
