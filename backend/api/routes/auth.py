from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import OperationalError

from backend.auth.dependencies import get_current_user
from backend.models.auth import LoginRequest, TokenResponse, UserResponse
from backend.services.user_service import (
    InactiveUserError,
    InvalidCredentialsError,
    JwtConfigurationError,
    UserService,
    public_user,
)
from backend.auth.jwt import create_access_token
from backend.core.settings import get_settings
from backend.auth.roles import UserRole


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    service = UserService()
    try:
        user = service.authenticate_user(email=payload.email, password=payload.password)
        access_token, expires_in = service.create_access_token_for_user(user)
    except OperationalError:
        settings = get_settings()
        if not settings.demo_auth_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database is unavailable. Start PostgreSQL and try again.",
            ) from None
        if payload.email not in {"driver1@example.com", "driver2@example.com", "driver3@example.com"} or payload.password != "driver123456":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        now = datetime.now(timezone.utc)
        user = {
            "user_id": f"demo-{payload.email.split('@', 1)[0]}",
            "full_name": payload.email.split("@", 1)[0].replace("driver", "Demo Driver "),
            "email": payload.email,
            "role": UserRole.DRIVER,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        if not settings.jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT secret is not configured.",
            ) from None
        expires_in = settings.access_token_expire_minutes * 60
        access_token = create_access_token(
            subject=user["user_id"],
            role=UserRole.DRIVER.value,
            secret=settings.jwt_secret,
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
            algorithm=settings.jwt_algorithm,
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from None
    except JwtConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from None

    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=UserResponse(**public_user(user)),
    )


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return UserResponse(**current_user)
