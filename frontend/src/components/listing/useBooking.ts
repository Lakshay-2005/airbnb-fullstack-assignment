"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useApp } from "@/context/AppProvider";
import { useToast } from "@/components/ui/Toast";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import {
  ApiError,
  bookingsApi,
  errorMessage,
  listingsApi,
  type ListingDetail,
} from "@/lib/api";
import { isValidRange, todayISO } from "@/lib/dates";

interface Initial {
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
}

/** All booking-card state: selection, server availability, the server-computed quote, reserving. */
export function useBooking(listing: ListingDetail, initial: Initial) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useApp();

  const validInitial =
    initial.checkIn && initial.checkOut && initial.checkIn >= todayISO() && isValidRange(initial.checkIn, initial.checkOut);
  const [checkIn, setCheckIn] = useState<string | null>(validInitial ? (initial.checkIn ?? null) : null);
  const [checkOut, setCheckOut] = useState<string | null>(validInitial ? (initial.checkOut ?? null) : null);
  const [guests, setGuests] = useState(() =>
    Math.min(Math.max(initial.guests ?? 1, 1), listing.guests_capacity),
  );
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const availability = useFetch((signal) => listingsApi.availability(listing.id, { signal }), [
    listing.id,
    user?.id,
  ]);
  const unavailable = useMemo(
    () => new Set(availability.data?.unavailable_dates ?? []),
    [availability.data],
  );

  const rangeReady = isValidRange(checkIn, checkOut);
  const overCapacity = guests > listing.guests_capacity;
  const queryKey = useDebounced(`${checkIn}|${checkOut}|${guests}|${couponCode}`, 250);
  const quote = useFetch(
    (signal) =>
      bookingsApi.quote(
        listing.id,
        { check_in: checkIn!, check_out: checkOut!, guests, coupon_code: couponCode || undefined },
        { signal },
      ),
    [queryKey, user?.id],
    rangeReady && !overCapacity,
  );

  const quoteData = rangeReady && !overCapacity ? quote.data : null;
  // A quote for old inputs is stale while the debounce/fetch catches up.
  const quoting = rangeReady && !overCapacity && (quote.loading || queryKey !== `${checkIn}|${checkOut}|${guests}|${couponCode}`);

  const setDates = useCallback((a: string | null, b: string | null) => {
    setCheckIn(a);
    setCheckOut(b);
    setReserveError(null);
  }, []);

  const applyCoupon = () => setCouponCode(couponInput.trim().toUpperCase());
  const removeCoupon = () => {
    setCouponCode("");
    setCouponInput("");
  };

  const validationMessage = overCapacity
    ? `This place fits up to ${listing.guests_capacity} guests.`
    : rangeReady && quoteData && !quoteData.bookable
      ? quoteData.message
      : null;

  const canReserve =
    rangeReady && !overCapacity && !quoting && Boolean(quoteData?.bookable) && !reserving;

  const reserve = async () => {
    if (!canReserve || !checkIn || !checkOut) return;
    setReserving(true);
    setReserveError(null);
    try {
      const booking = await bookingsApi.create({
        listing_id: listing.id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        coupon_code: quoteData?.coupon?.valid ? couponCode : null,
      });
      router.push(`/checkout/${booking.id}`);
    } catch (error) {
      const message = errorMessage(error);
      setReserveError(message);
      toast.error(message);
      if (error instanceof ApiError && error.status === 409) {
        // Someone else got there first: refresh availability so the calendar shows it.
        setCheckOut(null);
        availability.reload();
      }
      setReserving(false);
    }
  };

  return {
    checkIn,
    checkOut,
    guests,
    setGuests,
    setDates,
    unavailable,
    rangeReady,
    quote: quoteData,
    quoting,
    couponInput,
    setCouponInput,
    couponCode,
    applyCoupon,
    removeCoupon,
    validationMessage,
    reserveError,
    canReserve,
    reserving,
    reserve,
    isOwner: user?.id === listing.host.id,
  };
}

export type BookingState = ReturnType<typeof useBooking>;
