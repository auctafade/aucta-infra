# AUCTA Blockchain Infrastructure

AUCTA is a secure, closed digital infrastructure for authenticating, tracking, and managing the ownership lifecycle of luxury products.  
It anchors physical items to digital identity using NFC, private blockchains, and provable KYC.

---

## Project Structure

- **Frontend:** Next.js (React), TailwindCSS
- **Backend:** Node.js (REST API), Secure Controllers
- **Blockchain:** Private Substrate chain (Soulbound Tokens, multisig, ZKP-ready)
- **Storage:** IPFS / Arweave (off-chain metadata), PostgreSQL index

---

## Initial Setup

1. **Clone repository**
2. Copy `.env.local.example` to `.env.local` and fill secrets
3. Run `npm install` from the root
4. Start with provided scripts  
   (`frontend/`, `backend/`, `substrate-node/` coming soon)

---

## Developer Notes

- **Git:** Always branch from `main`, PRs must pass audit.
- **Secrets:** Never commit `.env.local` or real credentials.
- **Security:** 2FA and JWT recommended for all roles during development.
- **Scripts:** Add new env vars to `.env.local.example`.

---

## More info in `docs/` as the project evolves.