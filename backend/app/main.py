import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import items

load_dotenv()

app = FastAPI(
    title="Stock Portfolio API",
    description="FastAPI backend for the full-stack starter demo.",
    version="0.1.0",
)

# ---- CORS ----
# Allow the Next.js dev server (and production URL) to reach this API.
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(items.router)


# ---- Public routes ----
@app.get("/health", tags=["health"])
def health_check():
    """Public health-check endpoint — no auth required."""
    return {"status": "ok", "service": "FastAPI Backend"}
