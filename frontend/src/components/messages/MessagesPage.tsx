"use client";

import { ArrowLeft, MessageCircle, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Img } from "@/components/ui/Img";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { cn } from "@/lib/cn";
import { errorMessage, messagesApi, type ChatMessage, type Conversation } from "@/lib/api";

/** The API returns naive UTC timestamps. */
const asDate = (iso: string) => new Date(iso.endsWith("Z") ? iso : `${iso}Z`);

function formatWhen(iso: string, long = false): string {
  const date = asDate(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat(
    "en-US",
    long ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" },
  ).format(date);
}

/** Inbox: conversation list on the left, selected thread on the right (one pane at a time on phones). */
export function MessagesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, user, refreshUnread } = useApp();
  const selectedId = Number(params.get("c")) || null;

  const inbox = useFetch((signal) => messagesApi.list({ signal }), [user?.id], ready);
  const conversations = inbox.data;

  const select = (id: number | null) => router.push(id ? `/messages?c=${id}` : "/messages", { scroll: false });

  // On desktop show the newest thread right away; on phones the list comes first.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const activeId = selectedId ?? (wide && conversations?.length ? conversations[0].id : null);

  return (
    <div className="container-page pb-6 pt-6">
      <h1 className="mb-5 text-[26px] font-semibold tracking-tight md:text-[32px]">Messages</h1>

      {inbox.error && !conversations && <Alert tone="error">{inbox.error.message}</Alert>}

      {!conversations && !inbox.error && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {conversations && conversations.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Message a host from any listing page to ask about the stay. Replies show up here."
          actions={
            <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-ink px-5 font-semibold text-on-ink">
              Browse stays
            </Link>
          }
        />
      )}

      {conversations && conversations.length > 0 && (
        <div className="grid overflow-hidden rounded-2xl border border-line bg-paper md:h-[calc(100dvh-210px)] md:min-h-[480px] md:grid-cols-[340px_1fr]">
          <ConversationList
            className={cn(activeId && "hidden md:block")}
            conversations={conversations}
            activeId={activeId}
            onSelect={select}
          />
          {activeId ? (
            <Thread
              key={activeId}
              id={activeId}
              myId={user?.id ?? 0}
              onBack={() => select(null)}
              onActivity={() => {
                inbox.reload();
                void refreshUnread();
              }}
            />
          ) : (
            <div className="hidden items-center justify-center text-muted md:flex">Select a conversation</div>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  className,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  className?: string;
}) {
  return (
    <ul aria-label="Conversations" className={cn("divide-y divide-line overflow-y-auto md:border-r md:border-line", className)}>
      {conversations.map((c) => {
        const active = c.id === activeId;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface",
                active && "bg-surface",
              )}
            >
              <Avatar name={c.other_user.name} src={c.other_user.avatar} className="size-12" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-[15px]", c.unread_count ? "font-bold" : "font-semibold")}>
                    {c.other_user.name}
                  </span>
                  {c.last_message && (
                    <span className="shrink-0 text-xs text-muted">{formatWhen(c.last_message.created_at)}</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted">{c.listing.title}</span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn("truncate text-sm", c.unread_count ? "font-semibold text-ink" : "text-muted")}>
                    {c.last_message?.body}
                  </span>
                  {c.unread_count > 0 && (
                    <span
                      className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white"
                      aria-label={`${c.unread_count} unread`}
                    >
                      {c.unread_count}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Thread({
  id,
  myId,
  onBack,
  onActivity,
}: {
  id: number;
  myId: number;
  onBack: () => void;
  onActivity: () => void;
}) {
  const toast = useToast();
  const thread = useFetch((signal) => messagesApi.get(id, { signal }), [id]);
  const { data, setData } = thread;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  // Opening a thread marks it read on the server, so refresh the inbox badge once it has loaded.
  useEffect(() => {
    if (data && !opened.current) {
      opened.current = true;
      onActivity();
    }
  }, [data, onActivity]);

  const count = data?.messages.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message: ChatMessage = await messagesApi.send(id, body);
      setData((current) => (current ? { ...current, messages: [...current.messages, message] } : current));
      setDraft("");
      onActivity();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  if (thread.error && !data) {
    return (
      <div className="p-6">
        <Alert tone="error">{thread.error.message}</Alert>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center p-10" aria-busy="true">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <section aria-label={`Conversation with ${data.other_user.name}`} className="flex min-h-[420px] min-w-0 flex-col md:min-h-0">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all messages"
          className="-ml-1 flex size-9 items-center justify-center rounded-full transition-colors hover:bg-surface md:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={data.other_user.name} src={data.other_user.avatar} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{data.other_user.name}</p>
          <Link href={`/listings/${data.listing.id}`} className="block truncate text-sm text-muted underline-offset-2 hover:underline">
            {data.listing.title} · {data.listing.city}
          </Link>
        </div>
        <div className="hidden size-11 shrink-0 overflow-hidden rounded-lg sm:block">
          <Img src={data.listing.image} alt="" width={120} className="size-11" />
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-paper px-4 py-5" role="log" aria-live="polite">
        {data.messages.map((message, index) => {
          const mine = message.sender_id === myId;
          const previous = data.messages[index - 1];
          const newBlock = !previous || asDate(message.created_at).getTime() - asDate(previous.created_at).getTime() > 3_600_000;
          return (
            <div key={message.id}>
              {newBlock && (
                <p className="my-3 text-center text-xs text-muted">{formatWhen(message.created_at, true)}</p>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-snug",
                    mine ? "rounded-br-md bg-ink text-on-ink" : "rounded-bl-md bg-surface text-ink",
                  )}
                >
                  {message.body}
                </p>
              </div>
              <p className={cn("mt-0.5 px-1 text-[11px] text-muted", mine ? "text-right" : "text-left")}>
                {mine ? "You" : data.other_user.name.split(" ")[0]} · {formatWhen(message.created_at, true)}
                {mine && index === data.messages.length - 1 && message.read && " · Seen"}
              </p>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Write a message
        </label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-edge px-4 py-2.5 text-[15px] transition hover:border-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark active:scale-95 disabled:bg-brand-disabled"
        >
          {sending ? <Spinner className="size-4" /> : <SendHorizontal className="size-[18px]" />}
        </button>
      </form>
      <p className="border-t border-line px-4 py-2 text-center text-[11px] text-muted">
        Messages are saved on the server and shown when you open or send; there is no live push, so reopen the
        conversation to see new replies.
      </p>
    </section>
  );
}
