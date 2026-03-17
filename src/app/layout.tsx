import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/context/CartContext";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    metadataBase: new URL('https://www.sincethiscall.com'),
    title: 'SinceThisCall – Track Crypto & Stock Influencer Predictions | Accountability Tool',
    description: 'Track crypto and stock influencer calls with AI. See which gurus are actually right and which ones aren\'t. Real-time prediction accountability.',
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title: 'SinceThisCall – Track Crypto & Stock Influencer Predictions',
        description: 'Track crypto and stock influencer calls with AI. Real-time prediction accountability.',
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SinceThisCall",
    "applicationCategory": "FinanceApplication",
    "description": "AI-powered tracker for crypto and stock influencer predictions",
    "url": "https://www.sincethiscall.com"
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </head>
            <body className={`${inter.className} min-h-screen flex flex-col`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <CartProvider>
                        <Navbar />
                        <div className="flex-1">
                            {children}
                        </div>
                        <Footer />
                    </CartProvider>
                </ThemeProvider>
                <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ656XHDP" strategy="beforeInteractive" />
                <Script id="google-analytics" strategy="beforeInteractive">
                    {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());

                    gtag('config', 'G-ZZQ656XHDP');
                    `}
                </Script>
                <SpeedInsights />
            </body>
        </html>
    );
}
