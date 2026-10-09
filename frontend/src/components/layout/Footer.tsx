import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-page flex flex-col gap-3 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>
          Airbnb Clone · An independent educational project, not affiliated with or endorsed by
          Airbnb, Inc. Payments and sign-in are simulated.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-ink hover:underline">
            Explore
          </Link>
          <Link href="/wishlist" className="hover:text-ink hover:underline">
            Wishlist
          </Link>
          <Link href="/trips" className="hover:text-ink hover:underline">
            Trips
          </Link>
          <Link href="/messages" className="hover:text-ink hover:underline">
            Messages
          </Link>
          <Link href="/host" className="hover:text-ink hover:underline">
            Host a home
          </Link>
        </nav>
      </div>
    </footer>
  );
}
