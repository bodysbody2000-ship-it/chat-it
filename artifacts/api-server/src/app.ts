import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
// حل مشكلة الـ Import لـ pino-http المخصصة للـ bundlers
import pinoHttpFactory from "pino-http";
import { join } from "path";
import { mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const uploadsDir = join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// إجبار الـ TypeScript على قراءتها كـ دالة (Function) لتفادي خطأ TS2349 تماماً
const pinoMiddleware = (pinoHttpFactory as any)({
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
});

app.use(pinoMiddleware);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// سطر 18 وسطر 25 اللي كان فيهم الأخطاء متقفلين بـ Types صريحة دلوقتي
app.use((req: Request, res: Response, next: NextFunction) => {
  next();
});

app.use("/api/uploads", express.static(uploadsDir));
app.use("/api", router);

// الـ Error Handler في الآخر خالص مع تعريف الـ Types كاملة
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;