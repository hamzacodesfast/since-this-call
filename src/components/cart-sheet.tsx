"use client"

import { useState } from "react"
import Image from "next/image"
import { useCart } from "@/context/CartContext"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet"
import { Minus, Plus, ShoppingCart, Trash2, Loader2, CreditCard } from "lucide-react"

export function CartSheet() {
    const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, subtotal, totalItems } = useCart()
    const [isCheckingOut, setIsCheckingOut] = useState(false)

    const handleCheckout = async () => {
        if (items.length === 0) return
        setIsCheckingOut(true)

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || "Failed to create checkout session")
            }

            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error("Stripe checkout URL not generated")
            }
        } catch (error: any) {
            console.error('Error during checkout:', error)
            alert(`Checkout Error: ${error.message}`)
            setIsCheckingOut(false)
        }
    }

    return (
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-4 sm:p-6 bg-background">
                <SheetHeader className="pb-4">
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6" />
                        Your Cart ({totalItems})
                    </SheetTitle>
                </SheetHeader>

                {items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                            <ShoppingCart className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                        <p className="text-xl font-medium text-foreground">Your cart is empty</p>
                        <p className="text-muted-foreground text-sm max-w-[250px]">
                            Looks like you haven&apos;t added any merch to your cart yet.
                        </p>
                        <Button
                            className="mt-4 rounded-full px-8"
                            onClick={() => setIsCartOpen(false)}
                        >
                            Continue Shopping
                        </Button>
                    </div>
                ) : (
                    <>
                        <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
                            <div className="space-y-6">
                                {items.map((item) => (
                                    <div key={`${item.productId}-${item.variantId}`} className="flex gap-4">
                                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-muted/20 border flex-shrink-0">
                                            <Image
                                                src={item.image}
                                                alt={item.title}
                                                fill
                                                className="object-cover mix-blend-multiply dark:mix-blend-normal p-2"
                                            />
                                        </div>
                                        <div className="flex flex-col flex-1 justify-between py-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-foreground leading-tight line-clamp-2">{item.title}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1.5">{item.variantTitle}</p>
                                                </div>
                                                <div className="font-bold whitespace-nowrap">
                                                    ${(item.price / 100).toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center border rounded-md bg-muted/10">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-none hover:bg-muted/50"
                                                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                                                    >
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <div className="w-10 text-center text-sm font-medium">
                                                        {item.quantity}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-none hover:bg-muted/50"
                                                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeFromCart(item.productId, item.variantId)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="pt-6 space-y-4 border-t mt-4">
                            <div className="flex items-center justify-between text-lg font-bold">
                                <span>Subtotal</span>
                                <span>${(subtotal / 100).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Shipping and taxes calculated at checkout.
                            </p>
                            <Button
                                onClick={handleCheckout}
                                disabled={isCheckingOut || items.length === 0}
                                className="w-full text-base h-14 bg-foreground hover:bg-foreground/90 text-background rounded-full transition-all"
                            >
                                {isCheckingOut ? (
                                    <>
                                        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                                        Redirecting to Stripe...
                                    </>
                                ) : (
                                    <>
                                        Checkout <CreditCard className="ml-2 w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
