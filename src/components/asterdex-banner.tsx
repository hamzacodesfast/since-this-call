import Link from 'next/link';

export function AsterDexBanner() {
    return (
        <div className="w-full bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 border-y border-amber-500/30 py-3 px-4">
            <div className="container mx-auto flex items-center justify-center gap-3 text-sm">
                <span className="text-amber-400 font-bold">✨</span>
                <span className="text-foreground/90">
                    Trade crypto with low fees on{' '}
                    <Link
                        href="https://www.asterdex.com/en/referral/48b50b"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                    >
                        AsterDex
                    </Link>
                </span>
                <span className="text-amber-400 font-bold">✨</span>
            </div>
        </div>
    );
}
