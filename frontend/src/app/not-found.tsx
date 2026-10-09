import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      className="py-28"
      icon={Compass}
      title="This page wandered off"
      description="The page you're looking for doesn't exist. Let's get you back to finding a place to stay."
      actions={<ButtonLink href="/" variant="dark">Explore stays</ButtonLink>}
    />
  );
}
