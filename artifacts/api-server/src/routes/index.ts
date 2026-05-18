import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import messagesRouter from "./messages";
import apikeysRouter from "./apikeys";
import uploadRouter from "./upload";
import typingRouter from "./typing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(messagesRouter);
router.use(apikeysRouter);
router.use(uploadRouter);
router.use(typingRouter);

export default router;
