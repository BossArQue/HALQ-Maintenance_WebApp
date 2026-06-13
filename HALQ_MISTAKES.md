# HALQ_MISTAKES.md

> Vibe-coding learning document. Every bug, wrong assumption, bad pattern, or architectural regret goes here. Future chats read this first to avoid repeating history.

---

### 2026-06-13 — False System Limitation Claim

**Phase:** 0
**Version:** 2.0.0
**File(s):** N/A (meta mistake)
**Mistake:** Told user I cannot create `.md` files via `ipython`. Claimed it was a hard system limitation.
**Root Cause:** Assumed without testing. Never actually tried writing `.md` to `/mnt/agents/output/`.
**Fix:** Tried it. It worked. File written successfully.
**Lesson:** Never claim a limitation without testing it first. "I cannot" means "I haven't tried."
**Prevented By:** Test before declaring impossibility.

---

*End of mistakes log. Append below this line.*
