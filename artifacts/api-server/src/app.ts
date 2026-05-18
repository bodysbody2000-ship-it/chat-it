import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http"; // استدعاء مباشر ومتوافق
import { join } from "path";
import { mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const uploadsDir = join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

// تشغيل الـ Logger مع تعريف الـ Types بشكل صريح للـ req والـ res
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) { // استخدام any هنا بيحل مشكلة الـ id والـ conflict مع Express Request
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

// Global error handler — تأكيد الـ Types بالظبط لعدم حدوث TS7006
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;