import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { CreateApiKeyBody, DeleteApiKeyParams } from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/apikeys", authMiddleware, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(apiKeysTable)
    .orderBy(apiKeysTable.createdAt);

  const keys = rows.map((k) => ({
    id: k.id,
    key: k.key,
    name: k.name,
    createdAt: k.createdAt.toISOString(),
  }));

  res.json(keys);
});

router.post("/apikeys", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const key = "ck_" + randomBytes(24).toString("hex");
  const [row] = await db
    .insert(apiKeysTable)
    .values({ key, name: parsed.data.name })
    .returning();

  req.log.info({ name: parsed.data.name }, "API key created");

  res.status(201).json({
    id: row.id,
    key: row.key,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/apikeys/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteApiKeyParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(apiKeysTable)
    .where(eq(apiKeysTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  logger.info({ id: params.data.id }, "API key deleted");
  res.sendStatus(204);
});

export default router;
