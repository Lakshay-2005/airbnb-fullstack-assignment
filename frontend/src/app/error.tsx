"use client";

import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      className="py-28"
      icon={TriangleAlert}
      title="Something went wrong"
      description="An unexpected error occurred. You can try again, or head back to the homepage."
      actions={
        <>
          <Button variant="dark" onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">Go home</ButtonLink>
        </>
      }
    />
  );
}
