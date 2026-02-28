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
    description: 'The AI Powered Social Prediction Tracker. Track the performance of financial influencers on X (Twitter) with verified price receipts.',
    openGraph: {
        title: 'Since This Call | AI Powered Social Prediction Tracker',
        description: 'The AI Powered Social Prediction Tracker. Verify every financial guru call with immutable receipts.',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
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
