import { router } from "../trpc";
import { authRouter } from "./auth";
import { submissionsRouter } from "./submissions";

export const appRouter = router({
  auth: authRouter,
  submissions: submissionsRouter,
});

export type AppRouter = typeof appRouter;
