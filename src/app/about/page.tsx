export default function AboutPage() {
    return (
        <main className="container mx-auto px-4 py-24 max-w-4xl space-y-12">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter">About Since This Call</h1>
                <p className="text-xl text-muted-foreground">
                    We track the accuracy of crypto and stock market predictions made on social media.
                </p>
            </div>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                    Our goal is to provide objective data on the performance of public financial predictions.
                    We believe that track records matter. By analyzing public statements against historical market data,
                    we aim to bring transparency to the financial influencer ecosystem.
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Legal & Liability</h2>
                <div className="p-6 rounded-xl bg-secondary/30 space-y-4">
                    <h3 className="font-medium text-foreground">Truth is the Defense</h3>
                    <p className="text-sm text-muted-foreground">
                        All data presented on this platform is factual and based on publicly available information.
                        We do not editorialize or express opinions on the character of individuals.
                        We simply calculate the percentage change of an asset price from the time a statement was made.
                    </p>

                    <h3 className="font-medium text-foreground">Fair Use</h3>
                    <p className="text-sm text-muted-foreground">
                        Screenshots of tweets and social media posts are used for the purposes of commentary,
                        criticism, and data analysis, which falls under Fair Use protections.
                    </p>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Takedown Requests</h2>
                <p className="text-muted-foreground">
                    If you believe any content violates your rights, please submit a formal request.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 border rounded-xl space-y-2">
                        <h3 className="font-medium">GDPR (Right to be Forgotten)</h3>
                        <p className="text-sm text-muted-foreground">
                            EU citizens may request the removal of personal data. Please provide proof of identity and specific URLs to be removed.
                        </p>
                    </div>
                    <div className="p-6 border rounded-xl space-y-2">
                        <h3 className="font-medium">DMCA (Copyright)</h3>
                        <p className="text-sm text-muted-foreground">
                            If you are the copyright holder of a specific image or text, submit a DMCA notice identifying the infringing material.
                        </p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                    Send all legal inquiries to: <a href="mailto:legal@sincethiscall.com" className="text-primary hover:underline">legal@sincethiscall.com</a>
                </p>
            </section>
        </main>
    );
}
