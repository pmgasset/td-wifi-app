// ===== src/store/cart.ts (Fixed) =====
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  product_images: string[];
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  isHydrated: boolean;
  addItem: (product: any, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  setHydrated: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isHydrated: false,
      
      setHydrated: () => set({ isHydrated: true }),
      
      addItem: (product, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find(item => item.product_id === product.product_id);
          
          if (existingItem) {
            return {
              items: state.items.map(item =>
                item.product_id === product.product_id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              )
            };
          }
          
          return {
            items: [...state.items, {
              product_id: product.product_id,
              product_name: product.product_name || product.name,
              product_price: product.product_price || product.price,
              quantity,
              product_images: product.product_images || product.images || ['/images/placeholder.jpg']
            }]
          };
        });
      },
      
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter(item => item.product_id !== productId)
        }));
      },
      
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        
        set((state) => ({
          items: state.items.map(item =>
            item.product_id === productId
              ? { ...item, quantity }
              : item
          )
        }));
      },
      
      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.product_price * item.quantity), 0);
      }
    }),
    {
      name: 'travel-data-cart',
      onRehydrateStorage: () => (state) => {
        // Set hydrated flag when storage is rehydrated
        state?.setHydrated();
      },
    }
  )
);