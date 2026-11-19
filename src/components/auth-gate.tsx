import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { renewSessionIfNeeded, useAuth } from "@/lib/auth";
import { loadDirectory, resetDirectory } from "@/lib/directory";
import { loadSettings, resetSettings } from "@/lib/settings";
import { loadProcurement, resetProcurement } from "@/lib/procurement-live";
import { loadStock, resetStock } from "@/lib/stock-live";
import { loadBranches, resetBranches } from "@/lib/branches-live";
import { loadWork, resetWork } from "@/lib/work-live";
import { loadWorkspace, resetWorkspace } from "@/lib/store";
import { pageAllowed } from "@/lib/menu-pages";

const publicPaths = new Set(["/login", "/reset-password", "/auth", "/portal-fornecedor"]);

export function AuthGate() {
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const auth = useAuth();
  const navigate = useNavigate();
  const isPublic = publicPaths.has(pathname);
  const pages = auth.user?.pages;
  const allowed = isPublic || auth.status !== "authenticated" || pageAllowed(pages, pathname);

  useEffect(() => {
    void renewSessionIfNeeded();
  }, [pathname]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void loadDirectory().finally(() => { void loadWorkspace(); });
      void loadStock(); void loadSettings(); void loadProcurement(); void loadBranches(); void loadWork();
    }
    if (auth.status === "anonymous") { resetDirectory(); resetStock(); resetSettings(); resetProcurement(); resetBranches(); resetWork(); resetWorkspace(); }
  }, [auth.status]);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (!isPublic && auth.status === "anonymous") navigate({ to: "/login", replace: true });
    if (pathname === "/login" && auth.status === "authenticated") {
      const destination = pages?.includes("/") ? "/" : pages?.[0];
      if (destination) navigate({ to: destination as "/", replace: true });
    }
  }, [auth.status, isPublic, navigate, pages, pathname]);

  useEffect(() => {
    if (auth.status !== "authenticated" || isPublic || allowed) return;
    const destination = pages?.find((page) => page !== pathname);
    if (destination) navigate({ to: destination as "/", replace: true });
  }, [allowed, auth.status, isPublic, navigate, pages, pathname]);

  if (!isPublic && auth.status !== "authenticated") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Validando sessão...
      </div>
    );
  }

  if (!isPublic && auth.status === "authenticated" && pages && pages.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Seu perfil não possui páginas liberadas.
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Validando sessão...
      </div>
    );
  }

  return <Outlet />;
}
