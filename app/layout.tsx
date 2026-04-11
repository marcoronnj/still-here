import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Still Here?",
  description: "Guess whether a famous person is alive or dead.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
