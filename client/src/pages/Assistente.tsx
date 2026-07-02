/**
 * Assistente.tsx — Assistente IA do Canaril
 *
 * Chat inteligente que combina:
 * - Contexto real do criadouro (plantel, reprodução, saúde)
 * - Gemini (externo) ou Anthropic como fallback
 * - Base de conhecimento FOB/OBJO interna
 *
 * Funcionalidades:
 * - Chat com histórico por sessão
 * - Sugestões de perguntas rápidas
 * - Indicador de provedor ativo (Gemini/Anthropic)
 * - Nova sessão com um clique
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { Bot, Send, Trash2, Plus, Zap, AlertCircle, ChevronDown } from "lucide-react";

// Gera sessionId único por conversa
function makeSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const QUICK_PROMPTS = [
  "Quais pássaros precisam de atenção de saúde?",
  "Explique o cruzamento Lutino × Lutino",
  "O que é COI e quando devo me preocupar?",
  "Como identificar o sexo de um canário jovem?",
  "Quais os cuidados na época de muda de penas?",
  "Me explique as classes FOB de lipocrômicos",
  "Como prevenir doenças respiratórias no criadouro?",
  "Quais mutações são ligadas ao sexo no canário?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
  latencyMs?: number;
  isLoading?: boolean;
}

export default function AssistentePage() {
  const [sessionId, setSessionId] = useState<string>(makeSessionId);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Status do assistente (provedor ativo, stats do criadouro)
  const { data: status } = trpc.aiAssistant.getStatus.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  // Histórico persistido
  const { data: history } = trpc.aiAssistant.getHistory.useQuery(
    { sessionId, limit: 50 },
    { enabled: !!sessionId }
  );

  // Sincroniza histórico com state local (apenas na carga inicial da sessão)
  useEffect(() => {
    if (history && history.length > 0 && messages.length === 0) {
      setMessages(
        history.map((h) => ({
          id: String(h.id),
          role: h.role as "user" | "assistant",
          content: h.content,
          provider: h.provider,
        }))
      );
    }
  }, [history]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = trpc.aiAssistant.chat.useMutation();
  const clearMutation = trpc.aiAssistant.clearHistory.useMutation();

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatMutation.isPending) return;

      setInput("");
      setShowQuickPrompts(false);

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const loadingMsg: ChatMessage = {
        id: `loading_${Date.now()}`,
        role: "assistant",
        content: "",
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);

      try {
        const result = await chatMutation.mutateAsync({
          message: trimmed,
          sessionId,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? {
                  id: `a_${Date.now()}`,
                  role: "assistant" as const,
                  content: result.response,
                  provider: result.provider,
                  latencyMs: result.latencyMs,
                  isLoading: false,
                }
              : m
          )
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Erro ao contactar a IA.";
        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? {
                  id: `err_${Date.now()}`,
                  role: "assistant" as const,
                  content: `⚠️ ${errMsg}`,
                  isLoading: false,
                }
              : m
          )
        );
      }
    },
    [chatMutation, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewSession = () => {
    setSessionId(makeSessionId());
    setMessages([]);
    setShowQuickPrompts(true);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClear = async () => {
    await clearMutation.mutateAsync({ sessionId });
    setMessages([]);
    setShowQuickPrompts(true);
  };

  const providerLabel = status?.provider === "gemini"
    ? "Gemini"
    : status?.provider === "anthropic"
    ? "Anthropic Claude"
    : null;

  const providerColor = status?.provider === "gemini"
    ? "text-blue-400"
    : status?.provider === "anthropic"
    ? "text-orange-400"
    : "text-gray-400";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="font-semibold text-white text-sm">Assistente IA</h1>
            {status && (
              <p className={`text-xs ${providerColor}`}>
                {status.aiAvailable
                  ? `${providerLabel} · ${status.stats.totalBirds} aves · ${status.stats.activeCouples} casais`
                  : "IA não configurada"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Limpar conversa"
              className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleNewSession}
            title="Nova conversa"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova
          </button>
        </div>
      </div>

      {/* Aviso: IA não configurada */}
      {status && !status.aiAvailable && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 text-sm font-medium">Assistente IA não configurado</p>
            <p className="text-red-400/80 text-xs mt-0.5">
              Configure <code className="bg-red-900/30 px-1 rounded">GEMINI_API_KEY</code> ou{" "}
              <code className="bg-red-900/30 px-1 rounded">ANTHROPIC_API_KEY</code> nas variáveis de ambiente do servidor.
            </p>
          </div>
        </div>
      )}

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Boas-vindas */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-9 h-9 text-gray-900" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Assistente Canaril</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Pergunte sobre saúde, genética, raças, rotina ou qualquer dúvida sobre o seu criadouro.
              </p>
            </div>

            {/* Stats rápidas */}
            {status && status.aiAvailable && (
              <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                {[
                  { label: "Aves ativas", value: status.stats.totalBirds },
                  { label: "Casais", value: status.stats.activeCouples },
                  { label: "Ninhos", value: status.stats.activeClutches },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800/50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-yellow-400">{s.value}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Perguntas rápidas */}
            {showQuickPrompts && status?.aiAvailable && (
              <div className="w-full max-w-lg">
                <p className="text-xs text-gray-500 mb-2 text-center">Sugestões de perguntas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition-colors border border-gray-700 hover:border-yellow-400/30"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mensagens */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-gray-900" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-yellow-400 text-gray-900 rounded-tr-sm"
                  : "bg-gray-800 text-gray-100 rounded-tl-sm"
              }`}
            >
              {msg.isLoading ? (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                </div>
              ) : (
                <>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.role === "assistant" && (msg.provider || msg.latencyMs) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                      {msg.provider && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Zap className="w-3 h-3" />
                          {msg.provider === "gemini" ? "Gemini" : "Anthropic"}
                        </span>
                      )}
                      {msg.latencyMs && (
                        <span className="text-[10px] text-gray-600">{msg.latencyMs}ms</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-gray-300">
                EU
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              status?.aiAvailable
                ? "Pergunte sobre saúde, genética, rotina... (Enter para enviar)"
                : "Configure a chave de IA para usar o assistente"
            }
            disabled={!status?.aiAvailable || chatMutation.isPending}
            rows={1}
            className="flex-1 resize-none bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-500 border border-gray-700 focus:border-yellow-400/50 focus:outline-none focus:ring-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-h-32 overflow-y-auto"
            style={{ minHeight: "48px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || chatMutation.isPending || !status?.aiAvailable}
            className="p-3 rounded-xl bg-yellow-400 text-gray-900 hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          O assistente pode cometer erros. Para diagnósticos sérios, consulte um veterinário.
        </p>
      </div>
    </div>
  );
}
