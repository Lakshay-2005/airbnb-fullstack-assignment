import { Suspense } from "react";
import { MessagesPage } from "@/components/messages/MessagesPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="container-page py-8" aria-busy="true" />}>
      <MessagesPage />
    </Suspense>
  );
}
