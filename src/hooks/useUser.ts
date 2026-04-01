import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { db } from '../db';

export function useUser() {
  const [user, setUserState] = useState<User>('bram');

  // On mount, sync from DB (canonical source after first migration)
  useEffect(() => {
    let cancelled = false;
    db.userSettings.get('current_user').then(record => {
      if (cancelled) return;
      if (record?.value === 'bram' || record?.value === 'helena') {
        setUserState(record.value as User);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const setUser = useCallback((newUser: User) => {
    setUserState(newUser);
    db.userSettings.put({ key: 'current_user', value: newUser });
  }, []);

  return { user, setUser };
}
