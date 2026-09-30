import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillForge - AI-Powered Technical Training",
  description:
    "Master technical skills with AI-generated practice tasks, spaced repetition, and gamified learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-gray-950 text-gray-100">{children}</body>
    </html>
  );
}
