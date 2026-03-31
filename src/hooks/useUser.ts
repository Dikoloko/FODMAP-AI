import { useState, useEffect } from 'react';
import type { User } from '../types';

const STORAGE_KEY = 'fodmap_current_user';

export function useUser() {
  const [user, setUser] = useState<User>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'bram' || stored === 'helena') ? stored : 'bram';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, user);
  }, [user]);

  return { user, setUser };
}
