import { useEffect, useState } from 'react';
import type { ParkedCart, ParkedCartCollection } from './parked-carts';

export interface ParkedCartStore {
  parked: ParkedCart[];
  /** Stores a parked cart. */
  park(cart: ParkedCart): Promise<void>;
  /** Deletes the parked cart with this id. */
  discard(id: string): Promise<void>;
  /** Takes the cart with this id out of the list, parking `current` in its place when given. */
  swap(id: string, current?: ParkedCart): Promise<void>;
}

/** Keeps parked carts in a collection or local React state. */
export function useParkedCarts(collection?: ParkedCartCollection): ParkedCartStore {
  const [parked, setParked] = useState<ParkedCart[]>([]);
  useEffect(() => {
    if (!collection) return;
    const subscription = collection.find({ sort: [{ parkedAt: 'desc' }] }).$.subscribe(docs => {
      setParked(docs.map(doc => doc.toJSON() as ParkedCart));
    });
    return () => subscription.unsubscribe();
  }, [collection]);
  return {
    parked,
    async park(cart) {
      if (collection) await collection.insert(cart);
      else setParked(carts => [cart, ...carts]);
    },
    async discard(id) {
      if (collection) await collection.findOne(id).remove();
      else setParked(carts => carts.filter(cart => cart.id !== id));
    },
    async swap(id, current) {
      if (collection) {
        if (current) await collection.insert(current);
        await collection.findOne(id).remove();
      } else setParked(carts => [...(current ? [current] : []), ...carts.filter(cart => cart.id !== id)]);
    },
  };
}
