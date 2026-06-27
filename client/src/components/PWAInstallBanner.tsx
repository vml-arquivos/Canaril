/**
 * PWAInstallBanner — Banner de instalação do app
 * Aparece no mobile quando o app ainda não foi instalado.
 * Usa o evento beforeinstallprompt do navegador.
 */
import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = (window.navigator as any).standalone;
    setIsIOS(ios);

    if (ios && !standalone && !localStorage.getItem("pwa-ios-dismissed")) {
      setShowIOS(true);
    }

    // Android / Chrome — beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Já instalado como PWA
  if ((window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches) {
    return null;
  }

  if (dismissed) return null;

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (isIOS) localStorage.setItem("pwa-ios-dismissed", "1");
  };

  // iOS — instrução manual
  if (isIOS && showIOS) {
    return (
      <div className="fixed bottom-4 left-3 right-3 z-50 bg-amber-700 text-white rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
        <Smartphone className="w-6 h-6 shrink-0 text-amber-200 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm mb-1">Instalar Canaril no iPhone</p>
          <p className="text-xs text-amber-200 leading-relaxed">
            Toque em <strong>Compartilhar</strong> ↑ e depois em <strong>"Adicionar à Tela de Início"</strong> para acesso rápido.
          </p>
        </div>
        <button onClick={handleDismiss} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-amber-600/60 active:bg-amber-500">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Android / Chrome — botão direto
  if (prompt) {
    return (
      <div className="fixed bottom-4 left-3 right-3 z-50 bg-amber-700 text-white rounded-2xl shadow-2xl p-4 flex gap-3 items-center">
        <div className="w-10 h-10 rounded-xl bg-amber-600/60 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-amber-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Instalar app Canaril</p>
          <p className="text-xs text-amber-200">Acesso rápido sem abrir o navegador</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-white text-amber-700 font-bold text-xs px-3 py-2 rounded-xl active:bg-amber-50"
        >
          Instalar
        </button>
        <button onClick={handleDismiss} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-amber-600/60 active:bg-amber-500">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
