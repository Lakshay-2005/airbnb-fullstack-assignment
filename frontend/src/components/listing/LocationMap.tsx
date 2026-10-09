import { ExternalLink, MapPin } from "lucide-react";

interface LocationMapProps {
  latitude: number | null;
  longitude: number | null;
  label: string;
}

/**
 * OpenStreetMap embed (no API key, no map library) centred on the stored coordinates, with a link to
 * the full map. Without coordinates it shows the address on a styled card instead of inventing a pin.
 */
export function LocationMap({ latitude, longitude, label }: LocationMapProps) {
  if (latitude === null || longitude === null) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-6 text-center md:h-80">
        <span className="flex size-12 items-center justify-center rounded-full bg-paper shadow-sm">
          <MapPin className="size-6 text-brand" />
        </span>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted">The host hasn&apos;t added map coordinates for this listing yet.</p>
      </div>
    );
  }
  const dLat = 0.012;
  const dLng = 0.022;
  const bbox = [longitude - dLng, latitude - dLat, longitude + dLng, latitude + dLat].join("%2C");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const full = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
  return (
    <figure>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <iframe
          title={`Map showing ${label}`}
          src={src}
          loading="lazy"
          className="block h-72 w-full md:h-[380px]"
          referrerPolicy="no-referrer"
        />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>The exact address is shared after you book.</span>
        <a
          href={full}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-2"
        >
          Open larger map <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}
