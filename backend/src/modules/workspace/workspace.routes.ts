import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../shared/errors.js";
import type { AuthService } from "../auth/auth.service.js";
import type { WorkspaceRepository } from "./workspace.repository.js";

const recordBody = z.object({ id: z.string().trim().min(1).max(80) }).passthrough();

export function registerWorkspaceRoutes(workspace: WorkspaceRepository, auth: AuthService) {
  return async function workspaceRoutes(app: FastifyInstance) {
    app.addHook("preHandler", async (request) => {
      await auth.me(request.headers.authorization);
    });

    app.get("/", async () => workspace.snapshot());

    app.put("/:kind/:id", async (request) => {
      const params = z.object({ kind: z.string().trim().min(1).max(40), id: z.string().trim().min(1).max(80) }).parse(request.params);
      const body = recordBody.parse(request.body);
      if (body.id !== params.id) throw new AppError(400, "ID", "O identificador do registro não confere.");
      try {
        await workspace.save(params.kind, params.id, body);
      } catch (error) {
        if (error instanceof Error && error.message === "KIND") throw new AppError(400, "KIND", "Tipo de registro inválido.");
        throw error;
      }
      return { ok: true };
    });

    app.delete("/:kind/:id", async (request) => {
      const params = z.object({ kind: z.string().trim().min(1).max(40), id: z.string().trim().min(1).max(80) }).parse(request.params);
      try {
        await workspace.remove(params.kind, params.id);
      } catch (error) {
        if (error instanceof Error && error.message === "KIND") throw new AppError(400, "KIND", "Tipo de registro inválido.");
        throw error;
      }
      return { ok: true };
    });
  };
}
