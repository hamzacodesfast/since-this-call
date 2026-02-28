'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
    const [isLoading, setIsLoading] = useState(false);
    const [product, setProduct] = useState<any>(null);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
    const { addToCart } = useCart();

    useEffect(() => {
        // Reset selected image when switching variants so it defaults to the new front view
        setSelectedImage(null);
    }, [selectedVariant]);

    useEffect(() => {
        async function fetchProduct() {
            try {
                // Fetch directly from our own new API route to hide Printify Key
                const res = await fetch(`/api/printify/product?id=${params.id}`);
                if (!res.ok) throw new Error('Product not found');
                const data = await res.json();
                setProduct(data.product);

                // Auto-select first in-stock enabled variant
                const variants = data.product?.variants || [];
                const firstEnabled = variants.find((v: any) => v.is_enabled);
                if (firstEnabled) setSelectedVariant(firstEnabled);

            } catch (err: any) {
                setFetchError(err.message);
            }
        }
        fetchProduct();
    }, [params.id]);


    const handleAddToCart = () => {
        if (!selectedVariant || !product) return;
        addToCart({
            productId: product.id,
            variantId: selectedVariant.id.toString(),
            title: product.title ? product.title.split(' | ')[0] : 'Unknown Product',
            price: selectedVariant.price,
            image: activeImage?.src || '',
            quantity: 1,
            variantTitle: selectedVariant.title
        });
    };

    if (fetchError) {
        return (
            <div className="container mx-auto px-4 py-24 text-center">
                <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
                <Link href="/merch"><Button>Back to Catalog</Button></Link>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="container mx-auto px-4 py-32 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const variants = product?.variants || [];
    const images = product?.images || [];

    // Build unique sizes and colors array from the active variants (Printify uses title strings like "Black / M")
    const activeVariants = variants.filter((v: any) => v.is_enabled);
    const availableOptions = activeVariants.map((v: any) => v.title.split(' / '));

    // Fallbacks to avoid throwing exceptions
    const fallbackPrice = activeVariants.length > 0 ? activeVariants[0].price : (variants[0]?.price || 3500);
    const price = ((selectedVariant?.price || fallbackPrice) / 100).toFixed(2);

    // Find images for this specific variant if possible, or fallback
    const variantImages = images.filter((img: any) => img.variant_ids?.includes(selectedVariant?.id));

    // Deduplicate images by src. Printify sometimes returns many identical mockups per variant.
    const uniqueImages = Array.from(new Map(variantImages.map((img: any) => [img.src, img])).values());

    // Default to the front position for the variant, or the first available
    const defaultImage = uniqueImages.find((img: any) => (img as any).position === 'front') || uniqueImages[0] || images[0];
    const activeImage = selectedImage || defaultImage;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isZoomed) return;
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        setMousePosition({ x, y });
    };

    return (
        <div className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
            <Link href="/merch" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 group">
                <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Back to Collection
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Product Images */}
                <div className="space-y-4">
                    <Card className="overflow-hidden border-2 bg-muted/20 border-muted/50 rounded-xl relative">
                        <CardContent
                            className="p-0 relative aspect-square cursor-crosshair group overflow-hidden"
                            onMouseEnter={() => setIsZoomed(true)}
                            onMouseLeave={() => {
                                setIsZoomed(false);
                                setMousePosition({ x: 50, y: 50 }); // Reset to center
                            }}
                            onMouseMove={handleMouseMove}
                        >
                            {activeImage && (
                                <div
                                    className="w-full h-full relative transition-[transform,transform-origin] duration-200 ease-out"
                                    style={{
                                        transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
                                        transform: isZoomed ? 'scale(2.5)' : 'scale(1)'
                                    }}
                                >
                                    <Image
                                        src={activeImage.src}
                                        alt={product?.title || 'Product'}
                                        fill
                                        className="object-cover mix-blend-multiply dark:mix-blend-normal"
                                        priority
                                    />
                                </div>
                            )}

                            {/* Zoom Hint Overlay */}
                            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm text-xs font-medium px-4 py-2 rounded-full transition-opacity duration-300 pointer-events-none border shadow-sm ${isZoomed ? 'opacity-0' : 'opacity-100'}`}>
                                Hover to Zoom
                            </div>
                        </CardContent>
                    </Card>

                    {/* Thumbnail Gallery */}
                    {uniqueImages.length > 1 && (
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                            {uniqueImages.map((img: any, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${activeImage?.src === img.src
                                        ? 'border-primary ring-2 ring-primary/20 opacity-100'
                                        : 'border-transparent opacity-60 hover:opacity-100 hover:border-primary/50 bg-muted/20'
                                        }`}
                                >
                                    <Image
                                        src={img.src}
                                        alt={`Thumbnail ${idx + 1}`}
                                        fill
                                        className="object-cover mix-blend-multiply dark:mix-blend-normal"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Details */}
                <div className="space-y-6 lg:space-y-8 lg:sticky lg:top-24 pb-24 lg:pb-0">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{product?.title ? product.title.split(' | ')[0] : 'Unknown Product'}</h1>
                        <div className="text-xl sm:text-2xl font-black text-foreground mb-4 sm:mb-6">${price}</div>
                        {product?.description && (
                            <div className="prose prose-sm sm:prose-base dark:prose-invert text-muted-foreground" dangerouslySetInnerHTML={{ __html: product.description }} />
                        )}
                    </div>

                    {/* Variant Selection */}
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-foreground text-sm sm:text-base">Select Variant</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {activeVariants.map((variant: any) => (
                                <Button
                                    key={variant.id}
                                    onClick={() => setSelectedVariant(variant)}
                                    variant={selectedVariant?.id === variant.id ? 'default' : 'outline'}
                                    className={`truncate ${selectedVariant?.id === variant.id ? 'bg-primary border-primary text-primary-foreground' : 'hover:border-primary/50'}`}
                                    size="sm"
                                >
                                    {variant.title}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t z-50 lg:relative lg:p-0 lg:bg-transparent lg:border-none lg:pt-6 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] lg:shadow-none">
                        <Button
                            onClick={handleAddToCart}
                            disabled={!selectedVariant}
                            className="w-full text-lg h-14 bg-foreground hover:bg-foreground/90 text-background rounded-full transition-all"
                        >
                            <ShoppingCart className="mr-2 w-5 h-5" />
                            Add to Cart
                        </Button>
                        <p className="hidden lg:flex text-xs text-center text-muted-foreground items-center justify-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Secure checkout powered by Stripe.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
