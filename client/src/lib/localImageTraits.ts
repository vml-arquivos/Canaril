export type LocalImageTraits = {
  source: "client_canvas";
  dominantColor: "yellow" | "orange" | "red" | "white" | "dark" | "mixed" | "unknown";
  yellowRatio: number;
  orangeRatio: number;
  redRatio: number;
  whiteRatio: number;
  darkRatio: number;
  saturationAverage: number;
  brightnessAverage: number;
  sampleCount: number;
};

function clampRatio(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(1, value / total));
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

/**
 * Extrai características visuais simples no navegador, sem API externa.
 *
 * Limitação proposital: isto NÃO é um modelo de visão profunda. É um
 * classificador local leve por histograma de cor, suficiente para sugerir
 * lipocromo básico e apoiar a busca no catálogo oficial. O usuário sempre
 * deve confirmar a classe oficial antes de gravar no perfil genético.
 */
export async function extractLocalImageTraitsFromUrl(url: string): Promise<LocalImageTraits> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 96;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas indisponível para análise local da imagem."));
        return;
      }

      ctx.drawImage(image, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      let total = 0;
      let yellow = 0;
      let orange = 0;
      let red = 0;
      let white = 0;
      let dark = 0;
      let satSum = 0;
      let brightSum = 0;

      // Crop central para reduzir bordas, gaiola e fundo.
      const min = Math.floor(size * 0.18);
      const max = Math.floor(size * 0.82);

      for (let y = min; y < max; y += 2) {
        for (let x = min; x < max; x += 2) {
          const idx = (y * size + x) * 4;
          const a = data[idx + 3];
          if (a < 180) continue;

          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const { h, s, v } = rgbToHsv(r, g, b);

          total++;
          satSum += s;
          brightSum += v;

          if (v > 0.78 && s < 0.25) {
            white++;
            continue;
          }
          if (v < 0.32) {
            dark++;
            continue;
          }
          if (s > 0.25 && h >= 42 && h <= 72) {
            yellow++;
            continue;
          }
          if (s > 0.25 && h >= 18 && h < 42) {
            orange++;
            continue;
          }
          if (s > 0.25 && (h < 18 || h > 345)) {
            red++;
            continue;
          }
        }
      }

      const ratios = {
        yellowRatio: clampRatio(yellow, total),
        orangeRatio: clampRatio(orange, total),
        redRatio: clampRatio(red, total),
        whiteRatio: clampRatio(white, total),
        darkRatio: clampRatio(dark, total),
      };

      const entries: Array<[LocalImageTraits["dominantColor"], number]> = [
        ["yellow", ratios.yellowRatio],
        ["orange", ratios.orangeRatio],
        ["red", ratios.redRatio],
        ["white", ratios.whiteRatio],
        ["dark", ratios.darkRatio],
      ];
      const [dominant, dominantRatio] = entries.sort((a, b) => b[1] - a[1])[0] ?? ["unknown", 0];
      const dominantColor = dominantRatio < 0.18 ? "mixed" : dominant;

      resolve({
        source: "client_canvas",
        dominantColor,
        ...ratios,
        saturationAverage: total ? satSum / total : 0,
        brightnessAverage: total ? brightSum / total : 0,
        sampleCount: total,
      });
    };

    image.onerror = () => reject(new Error("Não foi possível carregar a imagem para análise local."));
    image.src = url;
  });
}
