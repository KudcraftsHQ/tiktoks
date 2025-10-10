import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TikTok Carousel Library",
  description: "Organize and search your TikTok carousel collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <style dangerouslySetInnerHTML={{__html: `
          /* Prevent pinch-to-zoom globally */
          html, body {
            touch-action: pan-x pan-y;
            -webkit-user-select: none;
            user-select: none;
          }
          
          /* Allow pinch-to-zoom only on canvas editor area */
          .canvas-editor-area {
            touch-action: none;
            -webkit-user-select: none;
            user-select: none;
          }
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}
      >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Mobile header with menu trigger */}
              <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden sticky top-0 z-50">
                <SidebarTrigger />
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">TikTok Carousel</h2>
                </div>
              </header>

              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
      </body>
    </html>
  );
}
