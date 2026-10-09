const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const formatMoney = (amount: number): string => money.format(amount);

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const formatRating = (rating: number): string => rating.toFixed(2).replace(/0$/, "");

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Rewrites the width of Unsplash URLs so cards don't download 1600px photos. */
export function sizedImage(url: string, width: number): string {
  if (!url.includes("images.unsplash.com")) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("w", String(width));
    parsed.searchParams.set("q", "75");
    return parsed.toString();
  } catch {
    return url;
  }
}
