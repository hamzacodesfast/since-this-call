import Link from 'next/link';

export function Footer() {
    return (
        <footer className="w-full border-t border-border/40 bg-background py-8">
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground text-center md:text-left">
                    <p className="font-semibold text-foreground mb-1">Since This Call</p>
                    <p className="text-xs max-w-md">
                        For entertainment purposes only. Not financial advice.
                        We track the accuracy of public predictions using mathematical analysis.
                        We do not editorialize.
                    </p>
                </div>

                <div className="flex gap-6 text-sm font-medium text-muted-foreground">
                    <Link href="/" className="hover:text-foreground transition-colors">
                        Home
                    </Link>
                    <Link href="/about" className="hover:text-foreground transition-colors">
                        About & Legal
                    </Link>
                </div>

                <div className="text-xs text-muted-foreground opacity-50">
                    v0.1.0 • Gemini 2.0 Flash
                </div>
            </div>
        </footer>
    );
}
