
import { getUserProfile } from '@/lib/analysis-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, XCircle, MinusCircle, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AnalysisCard } from '@/components/analysis-card';

// Force dynamic rendering as we don't have ISR set up for profiles yet
export const dynamic = 'force-dynamic';

export default async function UserProfilePage({ params }: { params: { username: string } }) {
    const { username } = params;
    const { profile, history } = await getUserProfile(username);

    if (!profile) {
        return notFound();
    }

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[128px]" />
            </div>

            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header Nav */}
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Button>
                    </Link>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-muted flex items-center justify-center">
                            {profile.avatar ? (
                                <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-16 h-16 text-muted-foreground" />
                            )}
                        </div>
                        {/* Win Rate Badge */}
                        <div className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full font-bold text-sm shadow-lg border-2 border-background ${profile.winRate >= 50 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {profile.winRate.toFixed(1)}% WR
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight mb-1">@{profile.username}</h1>
                            <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>Last Verified: {new Date(profile.lastAnalyzed).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl">
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-4 text-center">
                                    <div className="text-2xl font-bold">{profile.totalAnalyses}</div>
                                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Calls</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-500/10 border-green-500/20">
                                <CardContent className="p-4 text-center">
                                    <div className="text-2xl font-bold text-green-500 flex items-center justify-center gap-2">
                                        <Trophy className="w-5 h-5" /> {profile.wins}
                                    </div>
                                    <div className="text-xs text-green-500/60 uppercase font-bold tracking-wider">Wins</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-500/10 border-red-500/20">
                                <CardContent className="p-4 text-center">
                                    <div className="text-2xl font-bold text-red-500 flex items-center justify-center gap-2">
                                        <XCircle className="w-5 h-5" /> {profile.losses}
                                    </div>
                                    <div className="text-xs text-red-500/60 uppercase font-bold tracking-wider">Losses</div>
                                </CardContent>
                            </Card>
                            {profile.neutral > 0 && (
                                <Card className="bg-yellow-500/10 border-yellow-500/20">
                                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-2">
                                            <MinusCircle className="w-5 h-5" /> {profile.neutral}
                                        </div>
                                        <div className="text-xs text-yellow-500/60 uppercase font-bold tracking-wider">Flat</div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2 border-b border-border/50 pb-4">
                        <span>Prediction History</span>
                        <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">{history.length}</span>
                    </h2>

                    {history.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {history.map((item) => (
                                <AnalysisCard key={item.id} analysis={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-muted-foreground">
                            No history found.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
