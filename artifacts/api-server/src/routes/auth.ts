import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";
import { verifyPassword, generateToken } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!verifyPassword(parsed.data.password)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = generateToken();
  res.json({ token });
});

export default router;
