import { describe, expect, it } from "vitest";
import { calculateColorCross } from "./colorGenetics";

describe("colorGenetics", () => {
  it("não classifica macho portador como fenótipo visual", () => {
    const result = calculateColorCross({
      male: { sex: "macho", pastel: "Z+Z-" },
      female: { sex: "fêmea", pastel: "Z-W" },
    });
    const pastel = result.byMutation.pastel;
    expect(pastel.sons).toEqual({ "Z+Z-": 0.25, "Z-Z-": 0.25 });
    expect(pastel.daughters).toEqual({ "Z+W": 0.25, "Z-W": 0.25 });
    const carrier = result.phenotypeSummary.expectedPhenotypes.find(
      (item) => item.sex === "macho" && item.isCarrier,
    );
    expect(carrier?.isVisual).toBe(false);
    expect(carrier?.probability).toBe(0.25);
  });

  it("trata opalino como autossômico recessivo no modelo documental", () => {
    const result = calculateColorCross({
      male: { sex: "macho", opalino: "Nm" },
      female: { sex: "fêmea", opalino: "Nm" },
    });
    expect(result.byMutation.opalino.inheritance).toBe("autosomal_recessive");
    expect(result.byMutation.opalino.offspring).toEqual({ NN: 0.25, Nm: 0.5, mm: 0.25 });
  });
});
