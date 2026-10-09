from enum import StrEnum


class UserRole(StrEnum):
    GUEST = "GUEST"
    HOST = "HOST"


class ListingStatus(StrEnum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"  # hidden from search, still editable by the host
    DELETED = "DELETED"  # soft-deleted so past trips keep their history


class BookingStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class PaymentStatus(StrEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class CouponType(StrEnum):
    PERCENTAGE = "PERCENTAGE"
    FLAT = "FLAT"
