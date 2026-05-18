import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { join } from "path";
import { mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

// الحل النهائي والأقوى لـ pino-http مع moduleResolution: bundler
// بنستخدم require العادية عشان نخلص من حوار الـ types والـ call signature خالص في السطر ده
const pinoHttp = require("pino-http");

const uploadsDir = join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// تشغيل الـ logger بدون أي تضارب في الـ Types
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/uploads", express.static(uploadsDir));
app.use("/api", router);

// السطر 18 والـ 25 والـ Error Handler متقفلين بـ Types كاملة عشان مستحيل الـ compiler يشتكي
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;