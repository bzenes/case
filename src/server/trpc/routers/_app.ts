import { router } from "../trpc";
import { authRouter } from "./auth";
import { campaignsRouter } from "./campaigns";
import { submissionsRouter } from "./submissions";

export const appRouter = router({
  auth: authRouter,
  campaigns: campaignsRouter,
  submissions: submissionsRouter,
});

export type AppRouter = typeof appRouter;
