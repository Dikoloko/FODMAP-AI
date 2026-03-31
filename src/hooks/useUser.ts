import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { db } from '../db';

export function useUser() {
  // Fast sync init from localStorage shadow; IndexedDB is canonical
  const [user, setUserState] = useState<User>(() => {
    try {
      const stored = localStorage.getItem('fodmap_current_user');
      return (stored === 'bram' || stored === 'helena') ? stored : 'bram';
    } catch { return 'bram'; }
  });

  // On mount, sync from DB (canonical source after first migration)
  useEffect(() => {
    db.userSettings.get('current_user').then(record => {
      if (record?.value === 'bram' || record?.value === 'helena') {
        setUserState(record.value as User);
      }
    });
  }, []);

  const setUser = useCallback((newUser: User) => {
    setUserState(newUser);
    localStorage.setItem('fodmap_current_user', newUser); // keep as fast-startup shadow
    db.userSettings.put({ key: 'current_user', value: newUser });
  }, []);

  return { user, setUser };
}
