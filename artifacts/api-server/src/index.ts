import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { verifyToken } from "./lib/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/api/ws/socket.io",
});

io.use((socket, next) => {
  const token = socket.handshake.auth["token"] as string | undefined;
  const apiKey = socket.handshake.auth["apiKey"] as string | undefined;
  if (apiKey || (token && verifyToken(token))) {
    next();
  } else {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  logger.info({ id: socket.id }, "Client connected");
  socket.on("disconnect", () => {
    logger.info({ id: socket.id }, "Client disconnected");
  });
});

app.set("io", io);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
