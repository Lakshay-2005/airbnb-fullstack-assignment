import { Suspense } from "react";
import { ListingDetailPage } from "@/components/listing/ListingDetailPage";

export default function ListingPage() {
  return (
    <Suspense>
      <ListingDetailPage />
    </Suspense>
  );
}
