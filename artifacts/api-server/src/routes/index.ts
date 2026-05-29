import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import matchesRouter from "./matches";
import predictionsRouter from "./predictions";
import rankingRouter from "./ranking";
import dashboardRouter from "./dashboard";
import syncRouter from "./sync";
import adminUsersRouter from "./adminUsers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(matchesRouter);
router.use(predictionsRouter);
router.use(rankingRouter);
router.use(dashboardRouter);
router.use(syncRouter);
router.use(adminUsersRouter);

export default router;
