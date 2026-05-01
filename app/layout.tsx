import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças - Henrique & Beatriz",
  description: "Dashboard de controle financeiro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F4F5F7] text-[#1A1A2E]">
        {children}
      </body>
    </html>
  );
}
