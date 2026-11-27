"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { QUICK_CREATE, type AppDefinition } from "@/lib/apps";

type PaletteItem = {
  id: string;
  label: string;
  href: string;
  meta: string;
  keywords?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

export function CommandPalette({
  open,
  onOpenChange,
  apps,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: AppDefinition[];
}) {
  const router = useRouter();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const navigation: PaletteItem[] = [];
  const seen = new Set<string>();
  for (const app of apps) {
    for (const tab of app.tabs) {
      if (seen.has(tab.href)) continue;
      seen.add(tab.href);
      navigation.push({
        id: `nav-${app.id}-${tab.id}`,
        label: tab.label,
        href: tab.href,
        meta: app.label,
        icon: app.icon,
        keywords: `${app.label} ${tab.label}`,
      });
    }
  }

  const create: PaletteItem[] = QUICK_CREATE.map((action) => ({
    id: `create-${action.id}`,
    label: action.label,
    href: action.href,
    meta: "Create",
    icon: action.icon,
    keywords: action.keywords,
  }));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Global search"
      shouldFilter
      className="cp-palette"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search size={16} className="shrink-0 text-ink-muted" />
        <Command.Input
          placeholder="Search pages and actions..."
          className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <kbd className="hidden rounded border border-line bg-shell px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:block">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-ink-muted">
          No matches. Try a page name such as &ldquo;Companies&rdquo;.
        </Command.Empty>

        <Command.Group heading="Go to">
          {navigation.map((item) => (
            <PaletteRow key={item.id} item={item} onSelect={go} />
          ))}
        </Command.Group>

        <Command.Group heading="Create">
          {create.map((item) => (
            <PaletteRow key={item.id} item={item} onSelect={go} />
          ))}
        </Command.Group>
      </Command.List>

      <div className="flex items-center gap-4 border-t border-line bg-shell px-4 py-2 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1">
          <CornerDownLeft size={12} /> open
        </span>
        <span className="flex items-center gap-1">
          <ArrowRight size={12} /> navigate
        </span>
        <span className="ml-auto hidden sm:block">Tip: press / anywhere to search</span>
      </div>
    </Command.Dialog>
  );
}

function PaletteRow({
  item,
  onSelect,
}: {
  item: PaletteItem;
  onSelect: (href: string) => void;
}) {
  const Icon = item.icon;
  return (
    <Command.Item
      value={`${item.meta} ${item.label}`}
      keywords={item.keywords ? item.keywords.split(" ") : undefined}
      onSelect={() => onSelect(item.href)}
      className="group flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-ink"
    >
      <Icon size={16} className="shrink-0 text-ink-muted group-data-[selected=true]:text-brand" />
      <span className="font-medium">{item.label}</span>
      <span className="cp-item-meta ml-auto text-[11px] text-ink-muted">{item.meta}</span>
    </Command.Item>
  );
}
