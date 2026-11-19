import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import type { WorkRepository } from "./work.repository.js";

export function registerWorkRoutes(work: WorkRepository, auth: AuthService) {
  return async function workRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      await auth.me(request.headers.authorization);
    });
    app.get("/summary", async () => work.summary());
  };
}
