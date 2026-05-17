import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Repo | GitHub Engineering Agent",
  description:
    "Autonomous GitHub-native engineering agent for CI analysis, regression detection, and safe fix pull requests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

// Made with Bob
// made by bob
