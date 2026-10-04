import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KJV Evidence Explorer",
  description: "A deterministic, inspectable KJV concordance and related-passage workbench.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
