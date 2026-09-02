# TRACE-X — SECURITY BASELINE & HARDENING SPECIFICATION

## 1. Authentication & Identity Hardening

### 1.1 Zero-Enumeration Enforcement
- **Signup Endpoint (`POST /api/v1/auth/register`):** Returns standard user representation without leaking account existence if duplicate email is entered.
- **Login Endpoint (`POST /api/v1/auth/login`):** Always returns generic `401 Unauthorized: Invalid email or password` whether account is missing, wrong password, or deactivated.
- **Forgot Password (`POST /api/v1/auth/forgot-password`):** Always returns `200 OK: If an eligible account exists with this email address, password reset instructions have been dispatched.` in constant time.
- **Reset Password (`POST /api/v1/auth/reset-password`):** Uniform invalid/expired responses.

### 1.2 Cryptographic Token Management
- **Entropy:** Tokens generated via CSPRNG (`secrets.token_urlsafe(32)`) providing 256 bits of entropy.
- **Storage at Rest:** Tokens are never stored in cleartext; only SHA-256 digests are persisted in `password_reset_tokens` and `email_verification_tokens`.
- **URL Delivery:** Reset tokens delivered via URL fragment (`#token=...`) rather than query parameters, preventing exposure in browser history and HTTP `Referer` headers.
- **Expiration & Single-Use:** Password reset tokens expire in 1 hour (admin-forced: 24h) and are marked `used=True` immediately upon redemption.
- **Session Revocation:** Resetting credentials or changing roles automatically revokes all active `refresh_token_sessions`.

---

## 2. Authorization & Scoping

- **RBAC Matrix:**
  - `admin`: Full administrative control, officer directory, health diagnostics, configuration.
  - `senior_investigator`: Create/manage cases, assign investigators, execute ACH and VoI analytics, PDF export.
  - `investigator`: Upload evidence, view assigned cases, explore graph network.
  - `auditor`: Read-only access to custody chains, system health, and tamper reports.
- **IDOR Protection:** Case-scoped data access enforced on `GET /evidence/{id}`, `DELETE /evidence/{id}`, `POST /cases/{id}/evidence`.

---

## 3. Defense-in-Depth Middleware & Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: Restricts scripts, frames, and connections to trusted origins.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (in production).
