from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Domain error rendered as {"detail": <message>, "code": <machine code>}."""

    def __init__(self, status_code: int, detail: str, code: str = "error"):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code


def bad_request(detail: str, code: str = "bad_request") -> AppError:
    return AppError(400, detail, code)


def not_found(detail: str = "Resource not found.", code: str = "not_found") -> AppError:
    return AppError(404, detail, code)


def forbidden(detail: str, code: str = "forbidden") -> AppError:
    return AppError(403, detail, code)


def conflict(detail: str, code: str = "conflict") -> AppError:
    return AppError(409, detail, code)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse({"detail": exc.detail, "code": exc.code}, status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse({"detail": str(exc.detail), "code": "http_error"}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errors = [
            {
                "field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query")),
                "message": e["msg"].removeprefix("Value error, "),
            }
            for e in exc.errors()
        ]
        first = errors[0]["message"] if errors else "Invalid request."
        return JSONResponse(
            {"detail": f"Validation failed: {first}", "code": "validation_error", "errors": errors},
            status_code=422,
        )
