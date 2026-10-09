import type { CurrencyTable } from "@/lib/currency";
import { request } from "./client";
import type {
  Availability,
  Booking,
  BookingInput,
  ChatMessage,
  Conversation,
  ConversationDetail,
  Destination,
  HostListing,
  HostSummary,
  ListingCard,
  ListingDetail,
  ListingInput,
  Meta,
  Page,
  Quote,
  ReviewList,
  Review,
  SearchFilters,
  User,
} from "./types";

export * from "./client";
export * from "./types";

interface Signal {
  signal?: AbortSignal;
}

export const usersApi = {
  current: (opts?: Signal) => request<User>("/users/current", opts),
  demoUsers: (opts?: Signal) => request<User[]>("/users/demo", opts),
  switchTo: (userId: number) =>
    request<{ token: string; user: User }>("/users/switch-demo-role", {
      method: "POST",
      body: { user_id: userId },
    }),
};

export const listingsApi = {
  search: (filters: SearchFilters, opts?: Signal) =>
    request<Page<ListingCard>>("/listings", { query: { ...filters }, ...opts }),
  /** `native: true` returns the listing's own currency (what a host edits); otherwise the display currency. */
  get: (id: number | string, opts?: Signal & { native?: boolean }) =>
    request<ListingDetail>(`/listings/${id}`, opts),
  availability: (id: number | string, opts?: Signal) =>
    request<Availability>(`/listings/${id}/availability`, opts),
  meta: (opts?: Signal) => request<Meta>("/meta", opts),
  destinations: (q?: string, opts?: Signal) =>
    request<Destination[]>("/destinations", { query: { q }, ...opts }),
};

export const bookingsApi = {
  quote: (
    listingId: number,
    params: { check_in: string; check_out: string; guests: number; coupon_code?: string; currency?: string },
    opts?: Signal,
  ) => request<Quote>(`/listings/${listingId}/quote`, { query: params, ...opts }),
  create: (input: BookingInput) => request<Booking>("/bookings", { method: "POST", body: input }),
  list: (opts?: Signal) => request<Booking[]>("/bookings", opts),
  get: (id: number | string, opts?: Signal) => request<Booking>(`/bookings/${id}`, opts),
  setCoupon: (id: number, code: string | null) =>
    request<Booking>(`/bookings/${id}/coupon`, { method: "PUT", body: { code } }),
  pay: (id: number, paymentMethod: string) =>
    request<Booking>(`/bookings/${id}/pay`, {
      method: "POST",
      body: { payment_method: paymentMethod },
    }),
  cancel: (id: number) => request<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
};

export const favoritesApi = {
  list: (opts?: Signal) => request<ListingCard[]>("/favorites", opts),
  ids: (opts?: Signal) => request<number[]>("/favorites/ids", opts),
  add: (listingId: number) => request<unknown>(`/favorites/${listingId}`, { method: "POST" }),
  remove: (listingId: number) => request<void>(`/favorites/${listingId}`, { method: "DELETE" }),
};

export const hostApi = {
  listings: (opts?: Signal) => request<HostListing[]>("/host/listings", opts),
  bookings: (opts?: Signal) => request<Booking[]>("/host/bookings", opts),
  summary: (opts?: Signal) => request<HostSummary>("/host/summary", opts),
  create: (input: ListingInput) =>
    request<ListingDetail>("/listings", { method: "POST", body: input }),
  update: (id: number | string, input: ListingInput) =>
    request<ListingDetail>(`/listings/${id}`, { method: "PUT", body: input }),
  remove: (id: number) => request<void>(`/listings/${id}`, { method: "DELETE" }),
};

export const reviewsApi = {
  list: (listingId: number | string, opts?: Signal) =>
    request<ReviewList>(`/listings/${listingId}/reviews`, { query: { limit: 100 }, ...opts }),
  create: (listingId: number, input: { rating: number; comment: string }) =>
    request<Review>(`/listings/${listingId}/reviews`, { method: "POST", body: input }),
};

export const couponsApi = {
  validate: (body: {
    code: string;
    listing_id?: number;
    check_in?: string;
    check_out?: string;
  }) =>
    request<{ valid: boolean; message: string; discount: number }>("/coupons/validate", {
      method: "POST",
      body,
    }),
};

export const messagesApi = {
  list: (opts?: Signal) => request<Conversation[]>("/conversations", opts),
  unreadCount: (opts?: Signal) => request<{ count: number }>("/conversations/unread-count", opts),
  get: (id: number, opts?: Signal) => request<ConversationDetail>(`/conversations/${id}`, opts),
  send: (id: number, body: string) =>
    request<ChatMessage>(`/conversations/${id}/messages`, { method: "POST", body: { body } }),
  start: (listingId: number, body: string) =>
    request<ConversationDetail>("/conversations", {
      method: "POST",
      body: { listing_id: listingId, body },
    }),
};

export const currenciesApi = {
  /** Supported currencies and the demo exchange rates (single source of truth: the server). */
  list: (opts?: Signal) => request<CurrencyTable>("/currencies", opts),
};
