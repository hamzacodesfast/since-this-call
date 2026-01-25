# 🛡️ Since This Call: Security Handbook (TL;DR)
**Updated:** January 25, 2026

The Vibe Coders' approach to keeping the "Receipts" safe.

---

## 🏗️ The Cheat Sheet

- **Access**: Deny by default. Check permissions on every request, not just the front door.
- **Config**: Kill default passwords immediately. Keep setups minimal and patched.
- **Dependencies**: Vet your libraries. If you didn't write it, scan it for vulnerabilities.
- **Crypto**: Don't get creative. Use standard algorithms (AES-GCM, Argon2) for all sensitive data.
- **Input**: Trust nothing. Use parameterized queries to kill Injection attacks (SQLi).
- **Design**: Don't trust the client. Validate logic and business flows server-side.
- **Auth**: Strong passwords are not enough—enforce Multi-Factor Authentication (MFA).
- **Integrity**: Sign your updates and secure your CI/CD pipeline. Don't let bad code sneak in.
- **Logging**: If you don't log it, it didn't happen. Monitor auth attempts and errors.
- **Errors**: Fail safely. Show users generic messages; keep the stack traces in your internal logs.

---

## 🧠 The Core Philosophy
**Trust nothing** (input, clients, or defaults) and **verify everything** (users, code, and dependencies).

---
*"The tape doesn't lie, and the security shouldn't fail."*
