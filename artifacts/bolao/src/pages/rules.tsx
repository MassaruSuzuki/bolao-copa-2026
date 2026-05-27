import { Layout } from "@/components/Layout";
import { BookOpen, CheckCircle2, XCircle, Star } from "lucide-react";

export default function RulesPage() {
  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Regras do Bolão</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Como funciona a pontuação</p>
          </div>
        </div>

        {/* Rule 1 — Exact score */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)",
            border: "1px solid rgba(201,162,39,0.25)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-primary fill-primary" />
              Acertou o placar exato
            </h2>
            <span
              className="text-2xl font-black px-4 py-1 rounded-xl"
              style={{ background: "rgba(201,162,39,0.2)", color: "hsl(43,74%,52%)" }}
            >
              5 pts
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Você apostou exatamente o placar que aconteceu no jogo.
          </p>

          <div
            className="rounded-xl p-4 space-y-2 text-sm"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-muted-foreground font-semibold uppercase text-xs tracking-wide mb-3">Exemplo</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Você apostou:</span>
              <span className="font-bold text-foreground">Brasil 2 × 1 Argentina</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Resultado real:</span>
              <span className="font-bold text-foreground">Brasil 2 × 1 Argentina</span>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-green-400 font-semibold">Placar exato — ganha 5 pontos</span>
            </div>
          </div>
        </div>

        {/* Rule 2 — Correct winner / draw */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              Acertou apenas o vencedor ou empate
            </h2>
            <span
              className="text-2xl font-black px-4 py-1 rounded-xl"
              style={{ background: "rgba(59,130,246,0.15)", color: "rgb(147,197,253)" }}
            >
              1 pt
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Você acertou quem venceu (ou que seria empate), mas não o placar exato.
          </p>

          {/* Example A — winner */}
          <div
            className="rounded-xl p-4 space-y-2 text-sm"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-muted-foreground font-semibold uppercase text-xs tracking-wide mb-3">Exemplo A — acertou o vencedor</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Você apostou:</span>
              <span className="font-bold text-foreground">Brasil 1 × 0</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Resultado real:</span>
              <span className="font-bold text-foreground">Brasil 3 × 2</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-green-400">Acertou que o Brasil venceu</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400">Não acertou o placar</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-blue-300 font-semibold">→ Ganha 1 ponto</span>
              </div>
            </div>
          </div>

          {/* Example B — draw */}
          <div
            className="rounded-xl p-4 space-y-2 text-sm"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-muted-foreground font-semibold uppercase text-xs tracking-wide mb-3">Exemplo B — acertou o empate</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Você apostou:</span>
              <span className="font-bold text-foreground">Brasil 1 × 1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Resultado real:</span>
              <span className="font-bold text-foreground">Brasil 3 × 3</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-green-400">Acertou o empate</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400">Não acertou o placar</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-blue-300 font-semibold">→ Ganha 1 ponto</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            Resumo da pontuação
          </div>
          <div className="divide-y divide-white/5">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-foreground">Placar exato</span>
              <span className="font-black text-primary text-lg">5 pts</span>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-foreground">Acertou vencedor ou empate</span>
              <span className="font-black text-blue-300 text-lg">1 pt</span>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-foreground">Errou tudo</span>
              <span className="font-black text-muted-foreground text-lg">0 pts</span>
            </div>
          </div>
        </div>

        {/* Obs */}
        <div
          className="rounded-xl px-5 py-4 text-sm text-muted-foreground"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="font-semibold text-foreground mb-1">⚠️ Observação importante</p>
          Os acertos <strong className="text-foreground">não são acumulativos</strong>. Se você acertar o placar exato, ganha apenas 5 pts — não ganha os pontos de vencedor junto.
        </div>
      </div>
    </Layout>
  );
}
