import { Router, type IRouter } from "express";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

const typingUsers = new Map<string, number>();
const TYPING_TIMEOUT_MS = 4000;

router.post("/typing", authMiddleware, (req, res): void => {
  const { username } = req.body as { username?: string };
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username required" });
    return;
  }
  typingUsers.set(username, Date.now());
  res.json({ ok: true });
});

router.get("/typing", authMiddleware, (req, res): void => {
  const now = Date.now();
  const active: string[] = [];
  for (const [user, ts] of typingUsers.entries()) {
    if (now - ts < TYPING_TIMEOUT_MS) {
      active.push(user);
    } else {
      typingUsers.delete(user);
    }
  }
  res.json({ typing: active });
});

export default router;
