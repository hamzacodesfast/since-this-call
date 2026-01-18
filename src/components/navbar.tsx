'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock, Trophy, Users } from 'lucide-react';

const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/recent', label: 'Recent', icon: Clock },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/profiles', label: 'Profiles', icon: Users },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
            <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <img src="/logo.png" alt="STC" className="w-6 h-6" />
                    <span className="hidden sm:inline">Since This Call</span>
                    <span className="sm:hidden">STC</span>
                </Link>

                {/* Nav Links */}
                <nav className="flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
