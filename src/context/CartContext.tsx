'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
    productId: string;
    variantId: string; // The Printify variant ID
    title: string;
    price: number; // in cents
    image: string;
    quantity: number;
    variantTitle: string; // e.g. "Black / M"
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (productId: string, variantId: string) => void;
    updateQuantity: (productId: string, variantId: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
    isCartOpen: boolean;
    setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Hydrate from localStorage
    useEffect(() => {
        setIsMounted(true);
        const savedCart = localStorage.getItem('merch_cart');
        if (savedCart) {
            try {
                setItems(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart from local storage", e);
            }
        }
    }, []);

    // Save to localStorage when items change
    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('merch_cart', JSON.stringify(items));
        }
    }, [items, isMounted]);

    const addToCart = useCallback((newItem: CartItem) => {
        setItems(currentItems => {
            const existingItem = currentItems.find(item => item.productId === newItem.productId && item.variantId === newItem.variantId);
            if (existingItem) {
                // If it already exists, just increase quantity
                return currentItems.map(item =>
                    (item.productId === newItem.productId && item.variantId === newItem.variantId)
                        ? { ...item, quantity: item.quantity + newItem.quantity }
                        : item
                );
            }
            // Otherwise, add new item
            return [...currentItems, newItem];
        });
        setIsCartOpen(true); // Auto-open cart when adding
    }, []);

    const removeFromCart = useCallback((productId: string, variantId: string) => {
        setItems(currentItems => currentItems.filter(item => !(item.productId === productId && item.variantId === variantId)));
    }, []);

    const updateQuantity = useCallback((productId: string, variantId: string, quantity: number) => {
        if (quantity < 1) return removeFromCart(productId, variantId);
        setItems(currentItems =>
            currentItems.map(item =>
                (item.productId === productId && item.variantId === variantId)
                    ? { ...item, quantity }
                    : item
            )
        );
    }, [removeFromCart]);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const totalItems = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            totalItems,
            subtotal,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
