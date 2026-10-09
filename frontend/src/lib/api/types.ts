export type UserRole = "GUEST" | "HOST";
export type ListingStatus = "ACTIVE" | "PAUSED" | "DELETED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  created_at: string;
}

export interface PublicUser {
  id: number;
  name: string;
  avatar: string | null;
  created_at: string | null;
}

export interface StayQuote {
  nights: number;
  total: number;
}

export interface ListingCard {
  id: number;
  title: string;
  location: string;
  city: string;
  country: string;
  property_type: string;
  category: string;
  guests_capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  nightly_price: number;
  rating: number;
  review_count: number;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  images: string[];
  host: PublicUser;
  stay: StayQuote | null;
}

export interface ListingDetail extends ListingCard {
  description: string;
  cleaning_fee: number;
  service_fee: number;
  amenities: string[];
  created_at: string;
  updated_at: string;
  host_listing_count: number;
}

export interface HostListing extends ListingCard {
  booking_count: number;
  upcoming_booking_count: number;
  earnings: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListingInput {
  title: string;
  description: string;
  location: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  category: string;
  guests_capacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  nightly_price: number;
  cleaning_fee: number;
  service_fee: number;
  status: ListingStatus;
  amenities: string[];
  images: string[];
}

export interface Availability {
  listing_id: number;
  range_start: string;
  range_end: string;
  unavailable_ranges: { check_in: string; check_out: string }[];
  unavailable_dates: string[];
}

export interface Meta {
  property_types: string[];
  categories: { id: string; label: string }[];
  amenities: string[];
  price_min: number;
  price_max: number;
}

export interface Destination {
  city: string;
  country: string;
  count: number;
}

export interface PriceBreakdown {
  nights: number;
  nightly_price: number;
  subtotal: number;
  cleaning_fee: number;
  service_fee: number;
  discount: number;
  total: number;
  currency: string;
}

export interface CouponCheck {
  code: string;
  valid: boolean;
  message: string;
  discount: number;
  description: string | null;
}

export interface Quote {
  listing_id: number;
  bookable: boolean;
  message: string | null;
  code: string | null;
  pricing: PriceBreakdown | null;
  coupon: CouponCheck | null;
}

export interface Payment {
  status: PaymentStatus;
  amount: number;
  method: string | null;
  failure_reason: string | null;
}

export interface Booking {
  id: number;
  reference: string;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  guests: number;
  nights: number;
  subtotal: number;
  cleaning_fee: number;
  service_fee: number;
  discount: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  hold_expires_at: string | null;
  created_at: string;
  can_cancel: boolean;
  can_review: boolean;
  listing: {
    id: number;
    title: string;
    city: string;
    country: string;
    location: string;
    property_type: string;
    image: string | null;
    host: PublicUser;
    status: string;
  };
  guest: PublicUser;
  guest_email: string | null;
  payment: Payment | null;
}

export interface BookingInput {
  listing_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  coupon_code?: string | null;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  user: PublicUser;
}

export interface ReviewList {
  items: Review[];
  total: number;
  average: number;
  can_review: boolean;
}

export interface HostSummary {
  listing_count: number;
  active_listing_count: number;
  booking_count: number;
  upcoming_booking_count: number;
  earnings: number;
}

export interface SearchFilters {
  location?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  min_price?: number;
  max_price?: number;
  property_type?: string[];
  category?: string;
  amenities?: string[];
  min_rating?: number;
  bedrooms?: number;
  bathrooms?: number;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read: boolean;
}

export interface Conversation {
  id: number;
  listing: { id: number; title: string; city: string; country: string; image: string | null };
  other_user: PublicUser;
  last_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}
