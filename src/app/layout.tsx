import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Since This Call",
    description: "Social Prediction Tracker",
};

import Script from "next/script";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} min-h-screen flex flex-col`}>
                <Navbar />
                <div className="flex-1">
                    {children}
                </div>
                <Footer />
                <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ656XHDP" strategy="beforeInteractive" />
                <Script id="google-analytics" strategy="beforeInteractive">
                    {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());

                    gtag('config', 'G-ZZQ656XHDP');
                    `}
                </Script>
            </body>
        </html>
    );
}
