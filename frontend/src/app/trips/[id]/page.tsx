import { Suspense } from "react";
import { TripDetailPage } from "@/components/booking/TripDetailPage";

export default function Page() {
  return (
    <Suspense>
      <TripDetailPage />
    </Suspense>
  );
}
