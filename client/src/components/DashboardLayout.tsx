/**
 * DashboardLayout.tsx — Layout principal com navegação lateral colapsável
 *
 * Filosofia de navegação:
 *   7 grupos principais (não 17 itens soltos)
 *   Sidebar colapsável → apenas ícones em tela pequena
 *   Mobile: ver MobileBottomNav (bottom bar com drawer)
 */
import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bird, Heart, ClipboardList, Dna,
  BarChart3, Settings, Shield, LogOut,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Egg, Tag, Trophy, DollarSign, TrendingUp, Search, Bot, Globe, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { MobileBottomNav } from "./MobileBottomNav";
import { isPlatformAdmin } from "@shared/permissions";

// ─── Estrutura de menu em grupos ────────────────────────────────────────────

type NavItem = { icon: React.ElementType; label: string; path: string; };
type NavGroup = { label: string; items: NavItem[]; defaultOpen?: boolean; };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Dashboard",   path: "/dashboard" },
      { icon: ClipboardList,   label: "Rotina Diária", path: "/rotina" },
    ],
  },
  {
    label: "Plantel",
    defaultOpen: true,
    items: [
      { icon: Bird,      label: "Pássaros",   path: "/birds" },
      { icon: Heart,     label: "Casais",     path: "/couples" },
      { icon: Egg,       label: "Posturas",   path: "/clutches" },
      { icon: TrendingUp,label: "Movimentos", path: "/plantel" },
    ],
  },
  {
    label: "Genética",
    defaultOpen: false,
    items: [
      { icon: Dna,       label: "Linhagem & Genética",  path: "/linhagem" },
      { icon: Dna,       label: "Calculadora",          path: "/genetics-calculator" },
      { icon: ClipboardList, label: "Mapa da Temporada",path: "/temporada" },
    ],
  },
  {
    label: "Infraestrutura",
    defaultOpen: false,
    items: [
      { icon: Tag,       label: "Anilhas",     path: "/rings" },
      { icon: Bird,      label: "Gaiolas",     path: "/cages" },
      { icon: Trophy,    label: "Campeonatos", path: "/championships" },
    ],
  },
  {
    label: "Gestão",
    defaultOpen: false,
    items: [
      { icon: Bot,        label: "Assistente IA", path: "/assistente" },
      { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
      { icon: BarChart3,  label: "Relatórios", path: "/reports" },
    ],
  },
  {
    label: "Sistema",
    defaultOpen: false,
    items: [
      { icon: Globe,    label: "Meu Site",       path: "/meu-site" },
      { icon: Users,    label: "Minha Equipe",   path: "/equipe" },
      { icon: Settings, label: "Configurações", path: "/settings" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  defaultOpen: false,
  items: [
    { icon: Shield, label: "Administração", path: "/admin" },
  ],
};

// ─── Busca global ────────────────────────────────────────────────────────────

function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data: birds } = (trpc as any).birds?.list?.useQuery?.({}, { enabled: open && q.length >= 2 }) ?? { data: [] };

  const results = q.length >= 2
    ? (birds ?? []).filter((b: any) =>
        b.ring?.toLowerCase().includes(q.toLowerCase()) ||
        b.displayTitle?.toLowerCase().includes(q.toLowerCase()) ||
        b.nickname?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
          placeholder="Buscar pássaro, anilha..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {results.map((b: any) => (
            <button
              key={b.id}
              className="w-full px-4 py-2.5 text-left hover:bg-amber-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
              onClick={() => { setLocation(`/birds/${b.id}/ficha`); setQ(""); setOpen(false); }}
            >
              <Bird className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-mono font-bold text-sm text-amber-700">{b.ring}</p>
                {b.displayTitle && <p className="text-xs text-gray-500 truncate">{b.displayTitle}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grupo de menu colapsável ─────────────────────────────────────────────────

function NavGroupSection({
  group, collapsed, location,
}: {
  group: NavGroup;
  collapsed: boolean;
  location: string;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? false);
  const hasActive = group.items.some((i) => location === i.path);

  if (collapsed) {
    // Sidebar em modo ícone — mostra apenas os ícones dos itens, sem grupo
    return (
      <div className="space-y-1">
        {group.items.map(({ icon: Icon, label, path }) => {
          const active = location === path;
          return (
            <Link key={path} href={path}>
              <div title={label} className={cn(
                "flex items-center justify-center w-9 h-9 rounded-xl mx-auto transition-colors cursor-pointer",
                active ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              )}>
                <Icon className="w-5 h-5" />
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      >
        {group.label}
        {hasActive && !open
          ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          : open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        }
      </button>
      {open && (
        <div className="space-y-0.5 mt-1">
          {group.items.map(({ icon: Icon, label, path }) => {
            const active = location === path;
            return (
              <Link key={path} href={path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors",
                  active
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}>
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-amber-700" : "text-gray-400")} />
                  {label}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

// Importação lazy do trpc para busca global
import { trpc } from "@/lib/trpc";
import { useLocation as useWouterLocation } from "wouter";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useWouterLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const isAdmin = isPlatformAdmin((user as any)?.role);

  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar — desktop only */}
      <aside className={cn(
        "hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2.5 px-4 py-4 border-b border-gray-100",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">VittaBird</p>
              <p className="text-xs text-gray-400 truncate">Plataforma de Criadouros</p>
            </div>
          )}
        </div>

        {/* Busca — apenas expandido */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-gray-50">
            <GlobalSearch />
          </div>
        )}

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {groups.map((group) => (
            <NavGroupSection
              key={group.label}
              group={group}
              collapsed={collapsed}
              location={location}
            />
          ))}
        </nav>

        {/* Footer — usuário + logout */}
        <div className={cn(
          "border-t border-gray-100 px-3 py-3 flex items-center gap-2",
          collapsed && "justify-center"
        )}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{user?.name ?? "Usuário"}</p>
              <p className="text-xs text-gray-400 truncate">{(user as any)?.role ?? ""}</p>
            </div>
          )}
          <button
            onClick={() => logout()}
            title="Sair"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Botão colapsar */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute left-full top-6 -ml-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow text-gray-400 hover:text-gray-600 z-10"
          style={{ position: "sticky" }}
          title={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* Topbar mobile */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="font-bold text-gray-900 text-sm">VittaBird</span>
          </div>
          <GlobalSearch />
        </header>

        <div className="px-4 py-5 md:px-6 md:py-6 pb-24 md:pb-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <MobileBottomNav />
    </div>
  );
}
