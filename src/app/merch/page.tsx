import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Sparkles, ShoppingCart } from 'lucide-react';

async function getProducts() {
    const printifyShopId = process.env.PRINTIFY_SHOP_ID;
    const printifyApiKey = process.env.PRINTIFY_API_KEY;

    if (!printifyShopId || !printifyApiKey || printifyApiKey === 'mock') {
        console.warn("Printify credentials missing, returning empty catalog");
        return [];
    }

    const res = await fetch(`https://api.printify.com/v1/shops/${printifyShopId}/products.json`, {
        headers: {
            'Authorization': `Bearer ${printifyApiKey}`
        },
        // Revalidate every 10 minutes to keep catalog fresh but fast
        next: { revalidate: 600 }
    });

    if (!res.ok) {
        console.error("Failed to fetch Printify products", await res.text());
        return [];
    }

    const json = await res.json();
    return json.data || [];
}

export default async function MerchStorePage() {
    const products = await getProducts();

    return (
        <div className="container mx-auto px-4 py-8 lg:py-16 max-w-7xl">
            {/* Header Section */}
            <div className="text-center space-y-6 mb-16 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium mb-4">
                    <Sparkles className="w-4 h-4" />
                    <span>Official Merch Store</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
                    The <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">No Cryin' In The Casino</span> Collection
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Wear Bootleg Graphic Tees of finance world's most infamous characters.
                </p>
            </div>

            {products.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed">
                    <p className="text-lg">No products found or store is currently offline.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((product: any) => {
                        // Safely extract images and variants
                        const images = product?.images || [];
                        const variants = product?.variants || [];

                        // Find the front mockup image
                        const frontImage = images.find((img: any) => img.position === 'front') || images[0];
                        // Find the cheapest active price, or fallback
                        const enabledVariants = variants.filter((v: any) => v.is_enabled);
                        const displayVariant = enabledVariants.length > 0 ? enabledVariants[0] : variants[0];
                        const rawPrice = displayVariant?.price || 3500;
                        const price = (rawPrice / 100).toFixed(2);

                        const safeTitle = product?.title ? product.title.split(' | ')[0] : 'Unknown Product';

                        return (
                            <Link href={`/merch/${product.id}`} key={product.id} className="group flex flex-col h-full">
                                <Card className="overflow-hidden border-2 bg-card hover:bg-accent/50 border-muted/50 rounded-2xl transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 flex-1 flex flex-col">
                                    <CardContent className="p-0 relative aspect-square bg-muted/30 overflow-hidden">
                                        {frontImage && frontImage.src ? (
                                            <Image
                                                src={frontImage.src}
                                                alt={safeTitle}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105 mix-blend-multiply dark:mix-blend-normal"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                                <ShoppingCart className="w-8 h-8 mb-2" />
                                                <span className="text-sm font-medium">Coming Soon</span>
                                            </div>
                                        )}

                                        {/* Hover Overlay Badge */}
                                        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm text-foreground text-sm font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 duration-300">
                                            View Details
                                        </div>
                                    </CardContent>

                                    <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
                                                {safeTitle}
                                            </h3>
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="text-2xl font-black text-foreground">${price}</span>
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
