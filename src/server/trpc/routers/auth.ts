import { asc } from "drizzle-orm";
import { z } from "zod";
import { clearSession, setSessionUserId } from "@/lib/session";
import { schema } from "@/server/db/client";
import { publicProcedure, router } from "../trpc";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  /** Dev-only: lists seeded users for the user-switcher. Not real auth. */
  listDevUsers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.users)
      .orderBy(asc(schema.users.email));
  }),

  switchUser: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await setSessionUserId(input.userId);
      return { ok: true } as const;
    }),

  signOut: publicProcedure.mutation(async () => {
    await clearSession();
    return { ok: true } as const;
  }),
});
