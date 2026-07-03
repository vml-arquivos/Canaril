/**
 * localImageTraits.ts
 *
 * Extrai características visuais de uma imagem no navegador via Canvas.
 * Sem API externa, sem upload — análise 100% local.
 *
 * IMPORTANTE sobre cores de canário no espaço HSV:
 *
 * Canário VERMELHO (intenso/nevado/mosaico): H ≈ 5–38, S > 0.45, V > 0.4
 *   "Vermelho" de canário é laranja-avermelhado no HSV — NÃO é vermelho puro.
 *   Vermelho puro (H < 10) é raro; o típico vermelho de canário cai em H 10–38.
 *
 * Canário AMARELO (intenso/nevado/mosaico): H ≈ 38–75, S > 0.25, V > 0.45
 *   Amarelo intenso: S > 0.55, H 38–65
 *   Amarelo nevado: S 0.25–0.55, H 40–72 (mais diluído)
 *
 * Canário BRANCO/PRATEADO: V > 0.78, S < 0.20
 *
 * Canário COM MELANINA (negro/ágata/canela/isabel): V < 0.45, S variável
 *   Padrão escuro nas asas e costas, mesmo em lipocrômicos.
 *
 * Canário MOSAICO (qualquer cor): concentração de cor nas extremidades —
 *   fronte, peito, asas. O centro do corpo é mais claro. Detectável pela
 *   diferença de saturação entre borda e centro do crop.
 *
 * Esta análise é um CLASSIFICADOR LOCAL LEVE — não substitui visão computacional
 * treinada. Confidence máxima ~0.65 (com traits claros).
 */

export type LocalImageTraits = {
  source: "client_canvas";
  // Cor dominante no corpo do pássaro
  dominantColor: "yellow" | "orange_red" | "red" | "white" | "dark" | "mixed" | "unknown";
  // Ratios de cor (0–1)
  yellowRatio: number;
  orangeRedRatio: number; // laranja-vermelho: cobre o "vermelho" de canário
  redRatio: number;       // vermelho puro (raro em canários)
  whiteRatio: number;
  darkRatio: number;
  // Métricas de textura
  saturationAverage: number;
  saturationCenter: number;  // saturação no centro (crop 40–60%)
  saturationBorder: number;  // saturação nas bordas (crop 10–30%)
  brightnessAverage: number;
  // Indicadores derivados
  mosaicIndex: number;   // borderSat - centerSat: alto = padrão mosaico
  melaninIndex: number;  // proporção de pixels escuros: > 0.3 = melanina presente
  sampleCount: number;
};

function clampRatio(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(1, value / total));
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn)      h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else                 h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/**
 * Classifica um pixel HSV na paleta de cores do canário.
 *
 * CALIBRAÇÃO baseada em fotos reais de canários:
 * - Vermelho canário (fator vermelho): H 5–38, S > 0.45
 * - Laranja intermediário: H 28–42, S > 0.35 (overlap vermelho/amarelo)
 * - Amarelo: H 38–78, S > 0.22
 * - Branco/prateado: V > 0.78, S < 0.22
 * - Escuro/melanina: V < 0.38
 */
function classifyPixel(h: number, s: number, v: number): "white" | "dark" | "orange_red" | "red" | "yellow" | "neutral" {
  // Branco / prateado
  if (v > 0.78 && s < 0.22) return "white";
  // Escuro / melanina
  if (v < 0.38) return "dark";
  // Sem saturação suficiente para cor definida
  if (s < 0.18) return "neutral";

  // Vermelho puro (H < 10 ou H > 345)
  if (s > 0.45 && (h < 10 || h > 345)) return "red";
  // Laranja-vermelho: cobre o "vermelho" típico de canário (H 10–42)
  if (s > 0.38 && h >= 10 && h < 42) return "orange_red";
  // Amarelo (H 38–78, sobreposição com laranja baixa saturação)
  if (s > 0.22 && h >= 38 && h <= 78) return "yellow";
  // Laranja com baixa sat ainda pode ser amarelo escuro
  if (s > 0.30 && h >= 25 && h < 42) return "orange_red";

  return "neutral";
}

export async function extractLocalImageTraitsFromUrl(url: string): Promise<LocalImageTraits> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const SIZE = 128; // maior resolução para melhor análise
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas indisponível para análise local da imagem."));
        return;
      }

      ctx.drawImage(image, 0, 0, SIZE, SIZE);
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

      // ── Contadores ────────────────────────────────────────────────────────
      let totalAll = 0, yellow = 0, orangeRed = 0, red = 0, white = 0, dark = 0;
      let satSum = 0, brightSum = 0;

      // Para cálculo de mosaico: borda (10–28%) vs centro (40–60%)
      const borderMin = Math.floor(SIZE * 0.10), borderMax = Math.floor(SIZE * 0.28);
      const ctrMin = Math.floor(SIZE * 0.40), ctrMax = Math.floor(SIZE * 0.60);
      let satBorderSum = 0, satBorderCount = 0;
      let satCtrSum = 0, satCtrCount = 0;

      // Região principal: 12–88% para excluir borda da gaiola
      const mainMin = Math.floor(SIZE * 0.12), mainMax = Math.floor(SIZE * 0.88);

      for (let y = mainMin; y < mainMax; y += 2) {
        for (let x = mainMin; x < mainMax; x += 2) {
          const idx = (y * SIZE + x) * 4;
          const a = data[idx + 3];
          if (a < 160) continue;

          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const { h, s, v } = rgbToHsv(r, g, b);

          totalAll++;
          satSum += s;
          brightSum += v;

          const cls = classifyPixel(h, s, v);
          if (cls === "yellow")     yellow++;
          else if (cls === "orange_red") orangeRed++;
          else if (cls === "red")   red++;
          else if (cls === "white") white++;
          else if (cls === "dark")  dark++;

          // Borda (para mosaico index)
          const inBorder = (y >= borderMin && y < borderMax) || (y > SIZE - borderMax && y <= SIZE - borderMin) ||
                           (x >= borderMin && x < borderMax) || (x > SIZE - borderMax && x <= SIZE - borderMin);
          const inCenter = y >= ctrMin && y < ctrMax && x >= ctrMin && x < ctrMax;
          if (inBorder) { satBorderSum += s; satBorderCount++; }
          if (inCenter) { satCtrSum += s; satCtrCount++; }
        }
      }

      const satCenter = satCtrCount > 0 ? satCtrSum / satCtrCount : 0;
      const satBorder = satBorderCount > 0 ? satBorderSum / satBorderCount : 0;

      // ── Determinar cor dominante ──────────────────────────────────────────
      // "Vermelho de canário" = orangeRed (H 10–42)
      // Unificamos red + orangeRed para detecção de "vermelho" real
      const effectiveRed = orangeRed + red;
      const entries: Array<[LocalImageTraits["dominantColor"], number]> = [
        ["yellow", yellow],
        ["orange_red", effectiveRed],
        ["white", white],
        ["dark", dark],
      ];
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const [dominant, dominantCount] = sorted[0] ?? ["unknown", 0];
      const dominantColor: LocalImageTraits["dominantColor"] =
        totalAll === 0 ? "unknown" :
        clampRatio(dominantCount, totalAll) < 0.16 ? "mixed" :
        dominant;

      resolve({
        source: "client_canvas",
        dominantColor,
        yellowRatio:    clampRatio(yellow, totalAll),
        orangeRedRatio: clampRatio(orangeRed, totalAll),
        redRatio:       clampRatio(red, totalAll),
        whiteRatio:     clampRatio(white, totalAll),
        darkRatio:      clampRatio(dark, totalAll),
        saturationAverage: totalAll ? satSum / totalAll : 0,
        saturationCenter: satCenter,
        saturationBorder: satBorder,
        brightnessAverage: totalAll ? brightSum / totalAll : 0,
        mosaicIndex:   satBorder - satCenter,  // > 0.08 = provável mosaico
        melaninIndex:  clampRatio(dark, totalAll),
        sampleCount: totalAll,
      });
    };

    image.onerror = () => reject(new Error("Não foi possível carregar a imagem para análise local."));
    image.src = url;
  });
};
