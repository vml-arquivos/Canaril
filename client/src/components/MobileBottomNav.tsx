/**
 * MobileBottomNav.tsx — Navegação inferior mobile para o Canaril
 *
 * Exibe 4 ações principais + "Mais" que abre um drawer.
 * Visível apenas em telas < 768px (md).
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bird, Heart, ClipboardList, MoreHorizontal,
  Feather, DoorOpen, Calculator, BarChart3, Calendar, X,
  Trophy, Settings, TrendingUp, Map, Shield,
} from "lucide-react";

const PRIMARY_ITEMS = [
  { icon: LayoutDashboard, label: "Início",  path: "/dashboard" },
  { icon: ClipboardList,   label: "Rotina",  path: "/rotina" },
  { icon: Bird,            label: "Pássaros", path: "/birds" },
  { icon: Heart,           label: "Casais",  path: "/couples" },
];

const MORE_ITEMS = [
  { icon: Feather,      label: "Anilhas",      path: "/rings" },
  { icon: DoorOpen,     label: "Gaiolas",      path: "/cages" },
  { icon: Calendar,     label: "Temporada",    path: "/temporada" },
  { icon: Map,          label: "Mapa",         path: "/criadouro-mapa" },
  { icon: Calculator,   label: "Calculadora",  path: "/genetics-calculator" },
  { icon: TrendingUp,   label: "Linhagem",     path: "/linhagem" },
  { icon: BarChart3,    label: "Relatórios",   path: "/reports" },
  { icon: Trophy,       label: "Campeonatos",  path: "/championships" },
  { icon: Settings,     label: "Config.",      path: "/settings" },
  { icon: Shield,       label: "Admin",        path: "/admin" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-area-bottom"
        role="navigation"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5 h-16">
          {PRIMARY_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = location === path;
            return (
              <Link key={path} href={path}>
                <button
                  type="button"
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center h-full gap-1 px-1 transition-colors active:scale-95 ${active ? "text-amber-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-amber-600" : ""}`} />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                  {active && <span className="absolute top-0 inset-x-0 h-0.5 bg-amber-500 rounded-b" />}
                </button>
              </Link>
            );
          })}

          {/* Mais */}
          <button
            type="button"
            aria-label="Mais opções"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center h-full gap-1 px-1 transition-colors active:scale-95 ${moreOpen ? "text-amber-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            {moreOpen ? <X className="w-5 h-5 text-amber-600" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      {/* "Mais" drawer */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-30 md:hidden bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-16 inset-x-0 z-40 md:hidden bg-white rounded-t-2xl border-t border-gray-100 shadow-2xl p-4 pb-6">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {MORE_ITEMS.map(({ icon: Icon, label, path }) => {
                const active = location === path;
                return (
                  <Link key={path} href={path}>
                    <button
                      type="button"
                      aria-label={label}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-3 w-full transition-colors active:scale-95 ${active ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium leading-none text-center">{label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Spacer so content doesn't hide behind bottom nav on mobile */}
      <div className="md:hidden h-16" aria-hidden="true" />
    </>
  );
}
