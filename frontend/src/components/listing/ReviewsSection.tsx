"use client";

import { MessageSquareText, Star } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { errorMessage, reviewsApi, type ListingDetail } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatRating, plural } from "@/lib/format";

const INITIAL_VISIBLE = 6;

export function ReviewsSection({ listing }: { listing: ListingDetail }) {
  const { user, ready } = useApp();
  const reviews = useFetch((signal) => reviewsApi.list(listing.id, { signal }), [listing.id, user?.id], ready);
  const [showAll, setShowAll] = useState(false);
  const data = reviews.data;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-28 py-10">
      <h2 id="reviews-heading" className="flex items-center gap-2 text-[22px] font-semibold">
        {data && data.total > 0 ? (
          <>
            <Star className="size-5 fill-ink" aria-hidden="true" />
            {formatRating(data.average)} · {plural(data.total, "review")}
          </>
        ) : (
          "Reviews"
        )}
      </h2>

      {!data && !reviews.error && (
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}
      {reviews.error && !data && <p className="mt-4 text-sm text-danger">{reviews.error.message}</p>}

      {data && data.total === 0 && (
        <EmptyState
          className="py-10"
          icon={MessageSquareText}
          title="No reviews yet"
          description="Be the first to stay here — reviews appear after a completed trip."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="mt-6 grid gap-x-16 gap-y-8 md:grid-cols-2">
            {(showAll ? data.items : data.items.slice(0, INITIAL_VISIBLE)).map((review) => (
              <li key={review.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={review.user.name} src={review.user.avatar} className="size-11" />
                  <div>
                    <p className="font-semibold">{review.user.name}</p>
                    <p className="text-sm text-muted">{formatDateTime(review.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-0.5" role="img" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("size-3.5", n <= review.rating ? "fill-ink" : "fill-line text-line")} />
                  ))}
                </div>
                <p className="mt-2 leading-relaxed text-ink/90">{review.comment}</p>
              </li>
            ))}
          </ul>
          {data.items.length > INITIAL_VISIBLE && (
            <Button variant="secondary" size="lg" className="mt-8" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show fewer reviews" : `Show all ${data.total} reviews`}
            </Button>
          )}
        </>
      )}

      {data?.can_review && <ReviewForm listingId={listing.id} onDone={reviews.reload} />}
    </section>
  );
}

function ReviewForm({ listingId, onDone }: { listingId: number; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) return setError("Choose a star rating.");
    if (comment.trim().length < 10) return setError("Please write at least 10 characters.");
    setBusy(true);
    setError(null);
    try {
      await reviewsApi.create(listingId, { rating, comment });
      toast.success("Thanks! Your review is live.");
      setComment("");
      setRating(0);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-10 max-w-xl rounded-2xl border border-line p-6">
      <h3 className="text-lg font-semibold">How was your stay?</h3>
      <p className="text-sm text-muted">You completed a trip here, so you can leave a review.</p>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star className={cn("size-8", n <= rating ? "fill-ink" : "text-edge")} />
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="sr-only">
        Your review
      </label>
      <Textarea
        id="review-comment"
        className="mt-4"
        placeholder="Share what you loved and what could be better"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        invalid={Boolean(error)}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="dark" className="mt-4" loading={busy}>
        Post review
      </Button>
    </form>
  );
}
