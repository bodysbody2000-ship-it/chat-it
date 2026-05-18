import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import { SendMessageBody, GetMessagesQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";
import { encrypt, decrypt } from "../lib/crypto";

const router: IRouter = Router();

router.get("/messages", authMiddleware, async (req, res): Promise<void> => {
  const parsed = GetMessagesQueryParams.safeParse(req.query);
  const limit = parsed.success && parsed.data.limit ? parsed.data.limit : 50;

  const rows = await db
    .select()
    .from(messagesTable)
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    content: m.type === "text" ? decrypt(m.content) : m.content,
    type: m.type,
    imageUrl: m.imageUrl ?? null,
    username: m.username,
    createdAt: m.createdAt.toISOString(),
  }));

  res.json(messages);
});

router.post("/messages", authMiddleware, async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, type, username, imageUrl } = parsed.data;
  const storedContent = type === "text" ? encrypt(content) : content;

  const [row] = await db
    .insert(messagesTable)
    .values({
      content: storedContent,
      type,
      username,
      imageUrl: imageUrl ?? null,
    })
    .returning();

  const message = {
    id: row.id,
    content: type === "text" ? decrypt(row.content) : row.content,
    type: row.type,
    imageUrl: row.imageUrl ?? null,
    username: row.username,
    createdAt: row.createdAt.toISOString(),
  };

  const io = req.app.get("io");
  if (io) {
    io.emit("message", message);
  }

  res.status(201).json(message);
});

export default router;
