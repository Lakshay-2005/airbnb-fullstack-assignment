"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  currenciesApi,
  errorMessage,
  favoritesApi,
  messagesApi,
  setToken,
  usersApi,
  type User,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ratesFrom, type CurrencyTable, type RateTable } from "@/lib/currency";

interface AppState {
  /** The acting demo user (null until the first /users/current response). */
  user: User | null;
  /** True once the session has been resolved; pages wait for it before fetching. */
  ready: boolean;
  demoUsers: User[];
  switchUser: (userId: number) => Promise<void>;
  favoriteIds: ReadonlySet<number>;
  toggleFavorite: (listingId: number) => Promise<void>;
  /** Unread chat messages for the acting user, shown as a badge in the account menu. */
  unreadMessages: number;
  refreshUnread: () => Promise<void>;
  /** Supported currencies and the demo exchange rates, from the server (null until loaded). */
  currencyTable: CurrencyTable | null;
  rates: RateTable;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(new Set());
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [currencyTable, setCurrencyTable] = useState<CurrencyTable | null>(null);
  const pending = useRef(new Set<number>());

  const refreshUnread = useCallback(async () => {
    try {
      setUnreadMessages((await messagesApi.unreadCount()).count);
    } catch {
      setUnreadMessages(0);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      setFavoriteIds(new Set(await favoritesApi.ids()));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    currenciesApi
      .list()
      .then((table) => !cancelled && setCurrencyTable(table))
      .catch(() => undefined); // the selector then falls back to its built-in list of codes
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let current: User;
        try {
          current = await usersApi.current();
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          setToken(null); // stale/forged token: fall back to the default demo guest
          current = await usersApi.current();
        }
        if (cancelled) return;
        setUser(current);
        const [users] = await Promise.all([usersApi.demoUsers(), loadFavorites(), refreshUnread()]);
        if (!cancelled) setDemoUsers(users);
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFavorites, refreshUnread, toast]);

  const switchUser = useCallback(
    async (userId: number) => {
      try {
        const session = await usersApi.switchTo(userId);
        setToken(session.token);
        setUser(session.user);
        await Promise.all([loadFavorites(), refreshUnread()]);
        toast.success(`Now browsing as ${session.user.name} (${session.user.role.toLowerCase()})`);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [loadFavorites, refreshUnread, toast],
  );

  const toggleFavorite = useCallback(
    async (listingId: number) => {
      if (pending.current.has(listingId)) return; // ignore double clicks while a request is in flight
      pending.current.add(listingId);
      const wasSaved = favoriteIds.has(listingId);
      const apply = (saved: boolean) =>
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      apply(!wasSaved);
      try {
        if (wasSaved) await favoritesApi.remove(listingId);
        else await favoritesApi.add(listingId);
        toast.info(wasSaved ? "Removed from your wishlist" : "Saved to your wishlist");
      } catch (error) {
        apply(wasSaved);
        toast.error(errorMessage(error));
      } finally {
        pending.current.delete(listingId);
      }
    },
    [favoriteIds, toast],
  );

  const rates = useMemo(() => ratesFrom(currencyTable), [currencyTable]);
  const value = useMemo(
    () => ({
      user,
      ready,
      demoUsers,
      switchUser,
      favoriteIds,
      toggleFavorite,
      unreadMessages,
      refreshUnread,
      currencyTable,
      rates,
    }),
    [user, ready, demoUsers, switchUser, favoriteIds, toggleFavorite, unreadMessages, refreshUnread, currencyTable, rates],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
