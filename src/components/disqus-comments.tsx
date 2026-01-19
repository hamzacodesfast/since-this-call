'use client';

import { DiscussionEmbed } from 'disqus-react';

interface DisqusCommentsProps {
    identifier: string;  // Unique ID for this discussion (e.g., username)
    title: string;       // Title for the discussion
    url?: string;        // Optional URL (will be auto-detected if not provided)
}

export function DisqusComments({ identifier, title, url }: DisqusCommentsProps) {
    const disqusConfig = {
        url: url || (typeof window !== 'undefined' ? window.location.href : ''),
        identifier: identifier,
        title: title,
    };

    return (
        <div className="mt-12 bg-card/50 backdrop-blur rounded-xl border border-border/50 p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                💬 Community Discussion
            </h2>
            <DiscussionEmbed
                shortname="sincethiscall"
                config={disqusConfig}
            />
        </div>
    );
}
