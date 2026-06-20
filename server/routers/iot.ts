import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cage_sensor_readings } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Faixas de referência usadas para alertar o criador (não bloqueiam o
// registro da leitura, só sinalizam fora do ideal).
export const IOT_THRESHOLDS = {
  temperatureC: { min: 16, max: 24 },
  humidityPct: { min: 40, max: 60 },
};

export const iotRouter = router({
  // Endpoint de ingestão — pronto para receber dados de sensores reais
  // quando o criador instalar esse tipo de equipamento (ESP32/Arduino com
  // sensor de temperatura/umidade, por exemplo).
  ingest: protectedProcedure
    .input(z.object({
      cageId: z.number().optional(),
      section: z.string().optional(),
      temperatureC: z.number().optional(),
      humidityPct: z.number().optional(),
      luminosityLux: z.number().optional(),
      ammoniaPpm: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(cage_sensor_readings).values(input);
      return { success: true };
    }),

  latestByCage: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [reading] = await db
        .select()
        .from(cage_sensor_readings)
        .where(eq(cage_sensor_readings.cageId, input))
        .orderBy(desc(cage_sensor_readings.recordedAt))
        .limit(1);
      if (!reading) return null;

      const alerts: string[] = [];
      if (reading.temperatureC != null && (reading.temperatureC < IOT_THRESHOLDS.temperatureC.min || reading.temperatureC > IOT_THRESHOLDS.temperatureC.max)) {
        alerts.push(`Temperatura fora da faixa ideal (${IOT_THRESHOLDS.temperatureC.min}–${IOT_THRESHOLDS.temperatureC.max}°C)`);
      }
      if (reading.humidityPct != null && (reading.humidityPct < IOT_THRESHOLDS.humidityPct.min || reading.humidityPct > IOT_THRESHOLDS.humidityPct.max)) {
        alerts.push(`Umidade fora da faixa ideal (${IOT_THRESHOLDS.humidityPct.min}–${IOT_THRESHOLDS.humidityPct.max}%)`);
      }

      return { ...reading, alerts };
    }),
});
