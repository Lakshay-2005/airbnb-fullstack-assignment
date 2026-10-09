"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { errorMessage, messagesApi, type ListingDetail } from "@/lib/api";

/** "Message host" button + composer dialog. Opens the thread in the inbox once the first message is sent. */
export function MessageHost({ listing }: { listing: ListingDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { user, refreshUnread } = useApp();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  if (!user || user.id === listing.host.id) return null;

  const send = async () => {
    setSending(true);
    try {
      const thread = await messagesApi.start(listing.id, body);
      void refreshUnread();
      setOpen(false);
      setBody("");
      router.push(`/messages?c=${thread.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" icon={<MessageCircle className="size-4" />} onClick={() => setOpen(true)}>
        Message host
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Message ${listing.host.name.split(" ")[0]}`}
        footer={
          <div className="flex justify-end">
            <Button loading={sending} disabled={!body.trim()} onClick={send}>
              Send message
            </Button>
          </div>
        }
      >
        <div className="p-6">
          <Field label={`Ask ${listing.host.name.split(" ")[0]} about ${listing.title}`} htmlFor="first-message">
            <Textarea
              id="first-message"
              value={body}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi! I have a question about the place…"
              autoFocus
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
