import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Health | Premium Inventory",
  description: "Reservation-based inventory checkout",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-black dark:bg-black dark:text-white">
        <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-12">
          {children}
        </main>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
