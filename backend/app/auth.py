import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

AUTH_SECRET = os.environ["AUTH_SECRET"]

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that validates the NextAuth JWT (signed with AUTH_SECRET).
    Returns the decoded token payload if valid, or raises HTTP 401.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            AUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # NextAuth doesn't set aud by default
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
