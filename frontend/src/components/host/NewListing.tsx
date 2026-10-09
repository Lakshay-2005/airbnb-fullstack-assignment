"use client";

import { KeyRound } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApp } from "@/context/AppProvider";
import { ListingForm } from "./ListingForm";

export function NewListing() {
  const { user, ready, demoUsers, switchUser } = useApp();
  if (ready && user?.role !== "HOST") {
    const demoHost = demoUsers.find((u) => u.email === "host@example.com");
    return (
      <EmptyState
        className="py-24"
        icon={KeyRound}
        title="Switch to a host account"
        description="Only hosts can create listings. Use the demo host to try it."
        actions={
          <>
            {demoHost && <Button variant="dark" onClick={() => switchUser(demoHost.id)}>Switch to {demoHost.name}</Button>}
            <ButtonLink href="/" variant="secondary">Back to exploring</ButtonLink>
          </>
        }
      />
    );
  }
  return <ListingForm />;
}
