import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AUTOfEEDS",
  description: "From Image to Content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-10 pt-20 sm:px-6 lg:ml-64 lg:p-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
