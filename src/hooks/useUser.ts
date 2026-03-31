import { useState, useEffect } from 'react';
import type { User } from '../types';

const STORAGE_KEY = 'fodmap_current_user';

export function useUser() {
  const [user, setUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === 'bram' || stored === 'helena') ? stored : 'bram';
    } catch { return 'bram'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, user); } catch { /* quota exceeded */ }
  }, [user]);

  return { user, setUser };
}
