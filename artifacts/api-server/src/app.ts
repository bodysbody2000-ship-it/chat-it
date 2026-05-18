import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import * as _pinoHttp from "pino-http";
import { join } from "path";
import { mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http uses `export =` syntax which conflicts with moduleResolution:"bundler"
// Cast through unknown to avoid TS2349 ("not callable") on all TypeScript versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoHttp = _pinoHttp as any;

const uploadsDir = join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Request & { id?: unknown }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Response) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global error handler — must have 4 params for Express to recognise it as error middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.use("/api/uploads", express.static(uploadsDir));
app.use("/api", router);

export default app;
