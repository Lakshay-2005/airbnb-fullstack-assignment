import { Suspense } from "react";
import { ExplorePage } from "@/components/listing/ExplorePage";
import { ListingGridSkeleton } from "@/components/ui/Skeleton";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-8">
          <ListingGridSkeleton />
        </div>
      }
    >
      <ExplorePage />
    </Suspense>
  );
}
