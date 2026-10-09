"""Guest <-> host messaging: seeded thread, permissions, read state and validation."""

import threading

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import VILLA


def _seeded_thread(client, guest):
    threads = client.get("/api/conversations", headers=guest).json()
    assert len(threads) == 1
    return threads[0]


def test_seeded_demo_thread_is_visible_to_guest_and_host(client, guest, host):
    thread = _seeded_thread(client, guest)
    assert thread["other_user"]["name"] == "Maya Kapoor"
    assert thread["unread_count"] == 1  # the host's latest reply is unread
    host_threads = client.get("/api/conversations", headers=host).json()
    assert [t["id"] for t in host_threads] == [thread["id"]]
    assert host_threads[0]["other_user"]["name"] == "Alex Morgan"
    assert host_threads[0]["unread_count"] == 0


def test_opening_a_thread_marks_incoming_messages_read(client, guest, host):
    thread = _seeded_thread(client, guest)
    detail = client.get(f"/api/conversations/{thread['id']}", headers=guest).json()
    assert len(detail["messages"]) == 4
    assert client.get("/api/conversations/unread-count", headers=guest).json() == {"count": 0}
    # the host's own messages were read; the guest's last message to the host stays as sent
    assert detail["messages"][-1]["read"] is True


def test_send_message_is_attributed_to_the_signed_in_user(client, guest, host, api):
    thread = _seeded_thread(client, guest)
    # a client-supplied sender is ignored: the server uses the bearer token
    res = client.post(
        f"/api/conversations/{thread['id']}/messages",
        json={"body": "  Thanks, see you soon!  ", "sender_id": api.id_of("host@example.com")},
        headers=guest,
    )
    assert res.status_code == 201
    assert res.json()["sender_id"] == api.id_of("guest@example.com")
    assert res.json()["body"] == "Thanks, see you soon!"
    # the host now has one unread message and can reply
    assert client.get("/api/conversations/unread-count", headers=host).json() == {"count": 1}
    reply = client.post(
        f"/api/conversations/{thread['id']}/messages", json={"body": "Safe travels!"}, headers=host
    )
    assert reply.json()["sender_id"] == api.id_of("host@example.com")


def test_unrelated_user_cannot_read_or_send(client, guest, other_host, api):
    thread = _seeded_thread(client, guest)
    outsider = api.as_user("priya@example.com")
    for headers in (other_host, outsider):
        assert client.get(f"/api/conversations/{thread['id']}", headers=headers).status_code == 403
        sent = client.post(f"/api/conversations/{thread['id']}/messages", json={"body": "hi"}, headers=headers)
        assert sent.status_code == 403
        assert client.get("/api/conversations", headers=headers).json() == []


def test_unknown_conversation_is_404(client, guest):
    assert client.get("/api/conversations/9999", headers=guest).status_code == 404


def test_empty_or_oversized_messages_are_rejected(client, guest):
    thread = _seeded_thread(client, guest)
    url = f"/api/conversations/{thread['id']}/messages"
    assert client.post(url, json={"body": "   "}, headers=guest).status_code == 422
    assert client.post(url, json={"body": "x" * 2001}, headers=guest).status_code == 422


def test_start_conversation_reuses_the_thread_per_listing(client, api):
    priya = api.as_user("priya@example.com")
    first = client.post("/api/conversations", json={"listing_id": VILLA, "body": "Is the pool heated?"}, headers=priya)
    assert first.status_code == 201
    again = client.post("/api/conversations", json={"listing_id": VILLA, "body": "And the beach?"}, headers=priya)
    assert again.json()["id"] == first.json()["id"]
    assert [m["body"] for m in again.json()["messages"]] == ["Is the pool heated?", "And the beach?"]


def test_host_cannot_message_their_own_listing(client, host):
    res = client.post("/api/conversations", json={"listing_id": VILLA, "body": "Hello me"}, headers=host)
    assert res.status_code == 400
    assert res.json()["code"] == "own_listing"


def test_start_conversation_on_missing_listing_is_404(client, guest):
    res = client.post("/api/conversations", json={"listing_id": 9999, "body": "Hi"}, headers=guest)
    assert res.status_code == 404


def test_opening_the_same_thread_concurrently_never_errors(client, guest):
    """Marking read is a write; two simultaneous opens must serialise instead of hitting SQLITE_BUSY."""
    thread = _seeded_thread(client, guest)
    statuses, barrier = [], threading.Barrier(6)

    def open_thread():
        with TestClient(app) as local:
            barrier.wait()
            statuses.append(local.get(f"/api/conversations/{thread['id']}", headers=guest).status_code)

    workers = [threading.Thread(target=open_thread) for _ in range(6)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join()
    assert statuses == [200] * 6
