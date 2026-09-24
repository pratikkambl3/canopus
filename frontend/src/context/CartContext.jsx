/* ================================================================
   CANOPUS — Shopping Cart Context
   Manages customer digital album cart with localStorage persistence.
   Prevents duplicate album purchases and supports slide-out drawer.
   ================================================================ */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getProducts } from '../services/storeService';

const CartContext = createContext(null);
const STORAGE_KEY = 'canopus_cart';

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (err) {
      console.warn('[Cart] Failed to persist cart to localStorage:', err);
    }
  }, [cartItems]);

  // Synchronize cart item prices with live catalogue from server
  const refreshCartPrices = useCallback(async () => {
    try {
      const liveProducts = await getProducts();
      if (!Array.isArray(liveProducts) || liveProducts.length === 0) return;

      const productMap = new Map(liveProducts.map(p => [p.id, p]));

      setCartItems(prev => {
        let hasChanges = false;
        const updated = prev.map(item => {
          const live = productMap.get(item.id);
          if (!live) return item;
          const livePrice = Number(live.price ?? 0);
          if (
            item.price !== livePrice ||
            item.title !== live.title ||
            (live.artworkUrl && item.artworkUrl !== live.artworkUrl)
          ) {
            hasChanges = true;
            return {
              ...item,
              price: livePrice,
              title: live.title || item.title,
              artworkUrl: live.artworkUrl || item.artworkUrl,
              artist: live.artist || item.artist,
            };
          }
          return item;
        });

        return hasChanges ? updated : prev;
      });
    } catch (err) {
      console.warn('[Cart] Failed to refresh cart prices:', err.message);
    }
  }, []);

  // Automatically refresh prices on mount
  useEffect(() => {
    refreshCartPrices();
  }, [refreshCartPrices]);

  const isInCart = useCallback((productId) => {
    return cartItems.some(item => item.id === productId);
  }, [cartItems]);

  const addToCart = useCallback((product) => {
    if (!product || !product.id) return false;

    setCartItems(prev => {
      // If already in cart, update price and metadata to latest live product price
      if (prev.some(item => item.id === product.id)) {
        return prev.map(item =>
          item.id === product.id
            ? {
                ...item,
                title:      product.title,
                artist:     product.artist || item.artist || '',
                price:      Number(product.price ?? item.price ?? 0),
                artworkUrl: product.artworkUrl || item.artworkUrl || null,
                genre:      product.genre || item.genre || '',
                trackCount: product.trackCount || (product.tracks ? product.tracks.length : item.trackCount || 0),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          id:         product.id,
          title:      product.title,
          artist:     product.artist || '',
          price:      Number(product.price ?? 0),
          artworkUrl: product.artworkUrl || null,
          genre:      product.genre || '',
          trackCount: product.trackCount || (product.tracks ? product.tracks.length : 0),
        }
      ];
    });

    setIsCartOpen(true);
    return true;
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const cartCount = cartItems.length;

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [cartItems]);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    cartCount,
    cartTotal,
    isCartOpen,
    openCart,
    closeCart,
    refreshCartPrices,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
