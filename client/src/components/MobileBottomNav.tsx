/**
 * MobileBottomNav.tsx — Navegação inferior mobile
 * 4 ações primárias + "Mais" drawer com todas as seções
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bird, Heart, ClipboardList, MoreHorizontal,
  Tag, Egg, BarChart3, Trophy, Settings, TrendingUp,
  Dna, DollarSign, Shield, X, Search, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { isPlatformAdmin } from "@shared/permissions";

const PRIMARY_ITEMS = [
  { icon: LayoutDashboard, label: "Início",   path: "/dashboard" },
  { icon: ClipboardList,   label: "Rotina",   path: "/rotina" },
  { icon: Bird,            label: "Pássaros", path: "/birds" },
  { icon: Heart,           label: "Casais",   path: "/couples" },
];

const MORE_GROUPS = [
  {
    label: "Plantel",
    items: [
      { icon: Egg,        label: "Posturas",   path: "/clutches" },
      { icon: TrendingUp, label: "Movimentos", path: "/plantel" },
      { icon: Tag,        label: "Anilhas",    path: "/rings" },
      { icon: Bird,       label: "Gaiolas",    path: "/cages" },
    ],
  },
  {
    label: "Genética",
    items: [
      { icon: Dna,          label: "Linhagem",    path: "/linhagem" },
      { icon: Dna,          label: "Calculadora", path: "/genetics-calculator" },
      { icon: ClipboardList,label: "Temporada",   path: "/temporada" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
      { icon: Bot,        label: "Assistente IA", path: "/assistente" },
      { icon: Trophy,     label: "Campeonatos",path: "/championships" },
      { icon: BarChart3,  label: "Relatórios", path: "/reports" },
      { icon: Settings,   label: "Config.",    path: "/settings" },
    ],
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = isPlatformAdmin((user as any)?.role);

  const adminGroup = {
    label: "Admin",
    items: [{ icon: Shield, label: "Admin", path: "/admin" }],
  };

  const allGroups = isAdmin ? [...MORE_GROUPS, adminGroup] : MORE_GROUPS;

  return (
    <>
      {/* Drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer de mais itens */}
      <div className={cn(
        "fixed bottom-16 inset-x-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 max-h-[75vh] overflow-y-auto",
        open ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">Navegação</span>
          <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-4 pb-8">
          {allGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map(({ icon: Icon, label, path }) => {
                  const active = location === path;
                  return (
                    <Link key={path} href={path}>
                      <button
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-full active:scale-95 transition-transform",
                          active ? "bg-amber-100 text-amber-800" : "bg-gray-50 text-gray-600"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", active ? "text-amber-700" : "text-gray-500")} />
                        <span className="text-xs font-medium text-center leading-tight">{label}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
        <div className="grid grid-cols-5 h-16">
          {PRIMARY_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = location === path;
            return (
              <Link key={path} href={path}>
                <button
                  aria-label={label}
                  className={cn(
                    "flex flex-col items-center justify-center h-full gap-1 transition-colors active:scale-95",
                    active ? "text-amber-700" : "text-gray-500"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center justify-center h-full gap-1 transition-colors",
              open ? "text-amber-700" : "text-gray-500"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
