import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { join } from "path";
import { mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const uploadsDir = join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// Lightweight request logger — avoids pino-http CJS/ESM interop issues
let requestId = 0;
app.use((req: Request, res: Response, next: NextFunction): void => {
  const id = ++requestId;
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        req: { id, method: req.method, url: req.url.split("?")[0] },
        res: { statusCode: res.statusCode },
        responseTime: Date.now() - start,
      },
      "request completed",
    );
  });
  next();
});

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.use("/api/uploads", express.static(uploadsDir));
app.use("/api", router);

export default app;
