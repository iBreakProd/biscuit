import type { Metadata } from "next";
import { Manrope, Cormorant_Garamond } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth/AuthContext";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Biscuit - Refined Ethereal AI",
  description: "Talk to your knowledge. An ethereal interface for data intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${cormorant.variable} light`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..200,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="text-sand-900 font-sans min-h-screen flex flex-col overflow-x-hidden selection:bg-stone-200 selection:text-black animated-bg antialiased">
        <div className="layout-container flex h-full grow flex-col relative w-full">
          {/* Global Abstract Background Effects */}
          <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-linear-to-br from-ivory-100 to-transparent rounded-full blur-[120px] opacity-40 animate-float"></div>
            <div className="absolute top-[30%] right-[-10%] w-[60vw] h-[60vw] bg-linear-to-bl from-pearl-200 to-transparent rounded-full blur-[140px] opacity-40 animate-float-delayed"></div>
            <div className="absolute bottom-[-20%] left-[10%] w-[50vw] h-[50vw] bg-stone-100/30 rounded-full blur-[100px] opacity-30"></div>
          </div>
          <Suspense fallback={<div className="min-h-screen bg-pearl-50" />}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </Suspense>
        </div>
      </body>
    </html>
  );
}
