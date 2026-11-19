import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { menuGroups } from "@/lib/menu-pages";
import { useAuth } from "@/lib/auth";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function ScreenSearch() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const groups = menuGroups.flatMap((group) => {
    const items = group.items.filter((item) => !auth.user?.pages || auth.user.pages.includes(item.to));
    return items.length ? [{ label: group.label, items }] : [];
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openScreen(to: (typeof menuGroups)[number]["items"][number]["to"]) {
    setOpen(false);
    void navigate({ to });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex h-9 min-w-0 flex-1 max-w-[280px] items-center gap-2 rounded-md bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Buscar uma tela...</span>
        <kbd className="hidden lg:inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} aria-label="Buscar uma tela" className="inline-flex sm:hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <Search className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content className="fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl">
            <DialogTitle className="sr-only">Buscar telas</DialogTitle>
            <DialogDescription className="sr-only">Digite o nome de uma tela do sistema e pressione Enter para abrir.</DialogDescription>
            <Command
              filter={(value, search) => fold(value).includes(fold(search)) ? 1 : 0}
            >
              <CommandInput placeholder="Buscar uma tela..." autoFocus />
              <CommandList className="max-h-[360px]">
                <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
                {groups.map((group) => (
                  <CommandGroup key={group.label} heading={group.label}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <CommandItem
                          key={item.to}
                          value={`${group.label} ${item.label} ${item.description}`}
                          onSelect={() => openScreen(item.to)}
                        >
                          <Icon />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
              <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
                <span>Enter abre a tela</span>
                <span>Esc fecha</span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
