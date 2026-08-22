import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import { projectsRouter } from "./routers/projects";
import { workshopRouter } from "./routers/workshop";
import { productionRouter } from "./routers/production";
import { revisionsRouter } from "./routers/revisions";
import { versionsRouter } from "./routers/versions";
import { exportsRouter } from "./routers/exports";
import { settingsRouter } from "./routers/settings";
import { draftingRouter } from "./routers/drafting";
import { styleRouter } from "./routers/style";
import { collaborationRouter } from "./routers/collaboration";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  projects: projectsRouter,
  workshop: workshopRouter,
  production: productionRouter,
  revisions: revisionsRouter,
  versions: versionsRouter,
  exports: exportsRouter,
  settings: settingsRouter,
  drafting: draftingRouter,
  style: styleRouter,
  collaboration: collaborationRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
