import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/usuarios-filiais")({
  head: () => ({ meta: [
    { title: "Perfis de Acesso | Grupo Sorrisos" },
    { name: "description", content: "Telas liberadas por perfil de acesso." },
    { property: "og:title", content: "Perfis de Acesso | Grupo Sorrisos" },
    { property: "og:description", content: "Telas liberadas por perfil de acesso." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/perfis", replace: true });
  }, [navigate]);
  return null;
}
