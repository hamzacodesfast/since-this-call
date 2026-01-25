'use client';

import React, { useState } from 'react';
import { Share, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScreenshotButtonProps {
    targetId: string;
    fileName?: string;
    shareText: string;
    replyToId?: string;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    buttonText?: string;
}

export function ScreenshotButton({
    targetId,
    shareText,
    replyToId,
    className,
    variant = "default",
    size = "lg",
    buttonText = "Share Receipt"
}: ScreenshotButtonProps) {
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async () => {
        const container = document.getElementById(targetId);
        if (!container) {
            console.error(`Target element #${targetId} not found`);
            return;
        }

        setIsSharing(true);

        try {
            // Use html-to-image instead of html2canvas for better SVG/CSS support
            const { toPng } = await import('html-to-image');

            const dataUrl = await toPng(container, {
                backgroundColor: '#030712',
                pixelRatio: 2,
                style: {
                    // Force any backdrop-blur to be ignored for capture
                    backdropFilter: 'none',
                }
            });

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                alert("📸 Receipt Copied! Paste it on X.");

                const text = `${shareText}\n\nCheck it out 👇 ${window.location.href}`;
                let url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                if (replyToId) {
                    url += `&in_reply_to=${replyToId}`;
                }
                window.open(url, '_blank');

            } catch (e) {
                console.error('Clipboard failed', e);
                alert("Please allow clipboard access to copy the image.");
            }

        } catch (e) {
            console.error('Screenshot failed', e);
            alert("Failed to generate screenshot.");
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <Button
            onClick={handleShare}
            size={size}
            variant={variant}
            disabled={isSharing}
            className={cn("font-bold gap-2 shadow-lg transition-all", className)}
        >
            {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Share className="w-4 h-4" />
            )}
            {isSharing ? "Generating..." : buttonText}
        </Button>
    );
}
