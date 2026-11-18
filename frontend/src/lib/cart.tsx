import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type CartItem = { type: 'work' | 'bundle'; id: number; label: string; price: number }

type CartState = {
  items: CartItem[]
  add: (i: CartItem) => void
  remove: (type: string, id: number) => void
  clear: () => void
  has: (type: string, id: number) => boolean
}

const Ctx = createContext<CartState | null>(null)
const KEY = 'adj-cart'

function load(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* navigation privée : le panier reste en mémoire */
    }
  }, [items])
  const has = (type: string, id: number) => items.some((i) => i.type === type && i.id === id)
  const add = (i: CartItem) => setItems((cur) => (cur.some((c) => c.type === i.type && c.id === i.id) ? cur : [...cur, i]))
  const remove = (type: string, id: number) => setItems((cur) => cur.filter((c) => !(c.type === type && c.id === id)))
  return <Ctx.Provider value={{ items, add, remove, clear: () => setItems([]), has }}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart hors CartProvider')
  return ctx
}
