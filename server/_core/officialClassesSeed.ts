/**
 * officialClassesSeed.ts
 *
 * Seed do catálogo oficial FOB/OBJO para a tabela official_bird_classes.
 * Baseado nos PDFs de nomenclatura oficial (NomenclaturaOficial-COR.pdf e
 * NomenclaturaOficial-PORTE.pdf) e no officialClassInterpreter.ts.
 *
 * REGRA: Este seed é ADITIVO — nunca apaga dados existentes.
 * Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente.
 */

import { getDb } from "../db";
import { official_bird_classes } from "../../drizzle/schema";
import { sql } from "drizzle-orm";
import { interpretOfficialClass } from "./officialClassInterpreter";

// ============================================================================
// Tipos
// ============================================================================
interface SeedClass {
  officialCode: string;
  officialName: string;
  abbreviation?: string;
  modality: "COR" | "PORTE";
  groupName?: string;
  subgroupName?: string;
  breedName?: string;
  bitola?: string;
  categoryName?: string;
}

// ============================================================================
// Catálogo de Canário de Cor (FOB/OBJO — COR)
// Baseado na nomenclatura oficial brasileira
// ============================================================================
const COR_CLASSES: SeedClass[] = [
  // ── Lipocrômicos sem fator ─────────────────────────────────────────────────
  // Amarelos
  { officialCode: "CC0101", officialName: "Amarelo Intenso",          abbreviation: "AM IN",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Amarelos",         categoryName: "intenso" },
  { officialCode: "CC0102", officialName: "Amarelo Nevado",           abbreviation: "AM NV",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Amarelos",         categoryName: "nevado" },
  { officialCode: "CC0103", officialName: "Amarelo Mosaico Macho",    abbreviation: "AM MS M",  modality: "COR", groupName: "Lipocrômicos", subgroupName: "Amarelos",         categoryName: "mosaico" },
  { officialCode: "CC0104", officialName: "Amarelo Mosaico Fêmea",    abbreviation: "AM MS F",  modality: "COR", groupName: "Lipocrômicos", subgroupName: "Amarelos",         categoryName: "mosaico" },
  // Vermelhos
  { officialCode: "CC0201", officialName: "Vermelho Intenso",         abbreviation: "VM IN",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Vermelhos",        categoryName: "intenso" },
  { officialCode: "CC0202", officialName: "Vermelho Nevado",          abbreviation: "VM NV",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Vermelhos",        categoryName: "nevado" },
  { officialCode: "CC0203", officialName: "Vermelho Mosaico Macho",   abbreviation: "VM MS M",  modality: "COR", groupName: "Lipocrômicos", subgroupName: "Vermelhos",        categoryName: "mosaico" },
  { officialCode: "CC0204", officialName: "Vermelho Mosaico Fêmea",   abbreviation: "VM MS F",  modality: "COR", groupName: "Lipocrômicos", subgroupName: "Vermelhos",        categoryName: "mosaico" },
  // Brancos
  { officialCode: "CC0301", officialName: "Branco Dominante",         abbreviation: "BR DO",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Brancos" },
  { officialCode: "CC0302", officialName: "Branco Recessivo",         abbreviation: "BR RE",    modality: "COR", groupName: "Lipocrômicos", subgroupName: "Brancos" },
  // Marfins
  { officialCode: "CC0401", officialName: "Amarelo Marfim Intenso",   abbreviation: "AM MF IN", modality: "COR", groupName: "Lipocrômicos", subgroupName: "Marfins",          categoryName: "intenso" },
  { officialCode: "CC0402", officialName: "Amarelo Marfim Nevado",    abbreviation: "AM MF NV", modality: "COR", groupName: "Lipocrômicos", subgroupName: "Marfins",          categoryName: "nevado" },
  { officialCode: "CC0403", officialName: "Vermelho Marfim Intenso",  abbreviation: "VM MF IN", modality: "COR", groupName: "Lipocrômicos", subgroupName: "Marfins",          categoryName: "intenso" },
  { officialCode: "CC0404", officialName: "Vermelho Marfim Nevado",   abbreviation: "VM MF NV", modality: "COR", groupName: "Lipocrômicos", subgroupName: "Marfins",          categoryName: "nevado" },
  // ── Melânicos — Negro ──────────────────────────────────────────────────────
  { officialCode: "CC0501", officialName: "Negro Amarelo Intenso",    abbreviation: "NG AM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Negro",             categoryName: "intenso" },
  { officialCode: "CC0502", officialName: "Negro Amarelo Nevado",     abbreviation: "NG AM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Negro",             categoryName: "nevado" },
  { officialCode: "CC0503", officialName: "Negro Vermelho Intenso",   abbreviation: "NG VM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Negro",             categoryName: "intenso" },
  { officialCode: "CC0504", officialName: "Negro Vermelho Nevado",    abbreviation: "NG VM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Negro",             categoryName: "nevado" },
  { officialCode: "CC0505", officialName: "Negro Branco",             abbreviation: "NG BR",    modality: "COR", groupName: "Melânicos", subgroupName: "Negro" },
  // ── Melânicos — Ágata ─────────────────────────────────────────────────────
  { officialCode: "CC0601", officialName: "Ágata Amarelo Intenso",    abbreviation: "AG AM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Ágata",             categoryName: "intenso" },
  { officialCode: "CC0602", officialName: "Ágata Amarelo Nevado",     abbreviation: "AG AM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Ágata",             categoryName: "nevado" },
  { officialCode: "CC0603", officialName: "Ágata Vermelho Intenso",   abbreviation: "AG VM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Ágata",             categoryName: "intenso" },
  { officialCode: "CC0604", officialName: "Ágata Vermelho Nevado",    abbreviation: "AG VM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Ágata",             categoryName: "nevado" },
  { officialCode: "CC0605", officialName: "Ágata Branco",             abbreviation: "AG BR",    modality: "COR", groupName: "Melânicos", subgroupName: "Ágata" },
  // ── Melânicos — Canela ────────────────────────────────────────────────────
  { officialCode: "CC0701", officialName: "Canela Amarelo Intenso",   abbreviation: "CN AM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Canela",            categoryName: "intenso" },
  { officialCode: "CC0702", officialName: "Canela Amarelo Nevado",    abbreviation: "CN AM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Canela",            categoryName: "nevado" },
  { officialCode: "CC0703", officialName: "Canela Vermelho Intenso",  abbreviation: "CN VM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Canela",            categoryName: "intenso" },
  { officialCode: "CC0704", officialName: "Canela Vermelho Nevado",   abbreviation: "CN VM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Canela",            categoryName: "nevado" },
  { officialCode: "CC0705", officialName: "Canela Branco",            abbreviation: "CN BR",    modality: "COR", groupName: "Melânicos", subgroupName: "Canela" },
  // ── Melânicos — Isabelino ─────────────────────────────────────────────────
  { officialCode: "CC0801", officialName: "Isabelino Amarelo Intenso",  abbreviation: "IS AM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Isabelino",       categoryName: "intenso" },
  { officialCode: "CC0802", officialName: "Isabelino Amarelo Nevado",   abbreviation: "IS AM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Isabelino",       categoryName: "nevado" },
  { officialCode: "CC0803", officialName: "Isabelino Vermelho Intenso", abbreviation: "IS VM IN", modality: "COR", groupName: "Melânicos", subgroupName: "Isabelino",       categoryName: "intenso" },
  { officialCode: "CC0804", officialName: "Isabelino Vermelho Nevado",  abbreviation: "IS VM NV", modality: "COR", groupName: "Melânicos", subgroupName: "Isabelino",       categoryName: "nevado" },
  { officialCode: "CC0805", officialName: "Isabelino Branco",           abbreviation: "IS BR",    modality: "COR", groupName: "Melânicos", subgroupName: "Isabelino" },
  // ── Inos Lipocrômicos ─────────────────────────────────────────────────────
  { officialCode: "CC0901", officialName: "Lutino Amarelo Intenso",   abbreviation: "LT AM IN", modality: "COR", groupName: "Inos Lipocrômicos", subgroupName: "Lutino",    categoryName: "intenso" },
  { officialCode: "CC0902", officialName: "Lutino Amarelo Nevado",    abbreviation: "LT AM NV", modality: "COR", groupName: "Inos Lipocrômicos", subgroupName: "Lutino",    categoryName: "nevado" },
  { officialCode: "CC0903", officialName: "Rubino Vermelho Intenso",  abbreviation: "RB VM IN", modality: "COR", groupName: "Inos Lipocrômicos", subgroupName: "Rubino",    categoryName: "intenso" },
  { officialCode: "CC0904", officialName: "Rubino Vermelho Nevado",   abbreviation: "RB VM NV", modality: "COR", groupName: "Inos Lipocrômicos", subgroupName: "Rubino",    categoryName: "nevado" },
  { officialCode: "CC0905", officialName: "Albino",                   abbreviation: "AL",       modality: "COR", groupName: "Inos Lipocrômicos", subgroupName: "Albino" },
  // ── Pastel ────────────────────────────────────────────────────────────────
  { officialCode: "CC1001", officialName: "Pastel Amarelo Intenso",   abbreviation: "PT AM IN", modality: "COR", groupName: "Pastel", subgroupName: "Pastel Amarelo",        categoryName: "intenso" },
  { officialCode: "CC1002", officialName: "Pastel Amarelo Nevado",    abbreviation: "PT AM NV", modality: "COR", groupName: "Pastel", subgroupName: "Pastel Amarelo",        categoryName: "nevado" },
  { officialCode: "CC1003", officialName: "Pastel Vermelho Intenso",  abbreviation: "PT VM IN", modality: "COR", groupName: "Pastel", subgroupName: "Pastel Vermelho",       categoryName: "intenso" },
  { officialCode: "CC1004", officialName: "Pastel Vermelho Nevado",   abbreviation: "PT VM NV", modality: "COR", groupName: "Pastel", subgroupName: "Pastel Vermelho",       categoryName: "nevado" },
  { officialCode: "CC1005", officialName: "Pastel Branco",            abbreviation: "PT BR",    modality: "COR", groupName: "Pastel" },
  // ── Opalino ───────────────────────────────────────────────────────────────
  { officialCode: "CC1101", officialName: "Opalino Amarelo Intenso",  abbreviation: "OP AM IN", modality: "COR", groupName: "Opalino", subgroupName: "Opalino Amarelo",     categoryName: "intenso" },
  { officialCode: "CC1102", officialName: "Opalino Amarelo Nevado",   abbreviation: "OP AM NV", modality: "COR", groupName: "Opalino", subgroupName: "Opalino Amarelo",     categoryName: "nevado" },
  { officialCode: "CC1103", officialName: "Opalino Vermelho Intenso", abbreviation: "OP VM IN", modality: "COR", groupName: "Opalino", subgroupName: "Opalino Vermelho",    categoryName: "intenso" },
  { officialCode: "CC1104", officialName: "Opalino Vermelho Nevado",  abbreviation: "OP VM NV", modality: "COR", groupName: "Opalino", subgroupName: "Opalino Vermelho",    categoryName: "nevado" },
  // ── Ágata Pastel ──────────────────────────────────────────────────────────
  { officialCode: "CC1201", officialName: "Ágata Pastel Amarelo Intenso",  abbreviation: "AG PT AM IN", modality: "COR", groupName: "Ágata Pastel", categoryName: "intenso" },
  { officialCode: "CC1202", officialName: "Ágata Pastel Amarelo Nevado",   abbreviation: "AG PT AM NV", modality: "COR", groupName: "Ágata Pastel", categoryName: "nevado" },
  { officialCode: "CC1203", officialName: "Ágata Pastel Vermelho Intenso", abbreviation: "AG PT VM IN", modality: "COR", groupName: "Ágata Pastel", categoryName: "intenso" },
  { officialCode: "CC1204", officialName: "Ágata Pastel Vermelho Nevado",  abbreviation: "AG PT VM NV", modality: "COR", groupName: "Ágata Pastel", categoryName: "nevado" },
  // ── Canela Pastel ─────────────────────────────────────────────────────────
  { officialCode: "CC1301", officialName: "Canela Pastel Amarelo Intenso",  abbreviation: "CN PT AM IN", modality: "COR", groupName: "Canela Pastel", categoryName: "intenso" },
  { officialCode: "CC1302", officialName: "Canela Pastel Amarelo Nevado",   abbreviation: "CN PT AM NV", modality: "COR", groupName: "Canela Pastel", categoryName: "nevado" },
  { officialCode: "CC1303", officialName: "Canela Pastel Vermelho Intenso", abbreviation: "CN PT VM IN", modality: "COR", groupName: "Canela Pastel", categoryName: "intenso" },
  { officialCode: "CC1304", officialName: "Canela Pastel Vermelho Nevado",  abbreviation: "CN PT VM NV", modality: "COR", groupName: "Canela Pastel", categoryName: "nevado" },
  // ── Acetinado ─────────────────────────────────────────────────────────────
  { officialCode: "CC1401", officialName: "Acetinado Amarelo Intenso",  abbreviation: "AC AM IN", modality: "COR", groupName: "Acetinado", categoryName: "intenso" },
  { officialCode: "CC1402", officialName: "Acetinado Amarelo Nevado",   abbreviation: "AC AM NV", modality: "COR", groupName: "Acetinado", categoryName: "nevado" },
  { officialCode: "CC1403", officialName: "Acetinado Vermelho Intenso", abbreviation: "AC VM IN", modality: "COR", groupName: "Acetinado", categoryName: "intenso" },
  { officialCode: "CC1404", officialName: "Acetinado Vermelho Nevado",  abbreviation: "AC VM NV", modality: "COR", groupName: "Acetinado", categoryName: "nevado" },
  // ── Asas Cinza ────────────────────────────────────────────────────────────
  { officialCode: "CC1501", officialName: "Asas Cinza Amarelo Intenso",  abbreviation: "AS CZ AM IN", modality: "COR", groupName: "Asas Cinza", categoryName: "intenso" },
  { officialCode: "CC1502", officialName: "Asas Cinza Amarelo Nevado",   abbreviation: "AS CZ AM NV", modality: "COR", groupName: "Asas Cinza", categoryName: "nevado" },
  { officialCode: "CC1503", officialName: "Asas Cinza Vermelho Intenso", abbreviation: "AS CZ VM IN", modality: "COR", groupName: "Asas Cinza", categoryName: "intenso" },
  { officialCode: "CC1504", officialName: "Asas Cinza Vermelho Nevado",  abbreviation: "AS CZ VM NV", modality: "COR", groupName: "Asas Cinza", categoryName: "nevado" },
  // ── Topázio ───────────────────────────────────────────────────────────────
  { officialCode: "CC1601", officialName: "Topázio Amarelo Intenso",  abbreviation: "TP AM IN", modality: "COR", groupName: "Topázio", categoryName: "intenso" },
  { officialCode: "CC1602", officialName: "Topázio Amarelo Nevado",   abbreviation: "TP AM NV", modality: "COR", groupName: "Topázio", categoryName: "nevado" },
  { officialCode: "CC1603", officialName: "Topázio Vermelho Intenso", abbreviation: "TP VM IN", modality: "COR", groupName: "Topázio", categoryName: "intenso" },
  { officialCode: "CC1604", officialName: "Topázio Vermelho Nevado",  abbreviation: "TP VM NV", modality: "COR", groupName: "Topázio", categoryName: "nevado" },
  // ── Feo ───────────────────────────────────────────────────────────────────
  { officialCode: "CC1701", officialName: "Feo Amarelo Intenso",  abbreviation: "FE AM IN", modality: "COR", groupName: "Feo", categoryName: "intenso" },
  { officialCode: "CC1702", officialName: "Feo Amarelo Nevado",   abbreviation: "FE AM NV", modality: "COR", groupName: "Feo", categoryName: "nevado" },
  { officialCode: "CC1703", officialName: "Feo Vermelho Intenso", abbreviation: "FE VM IN", modality: "COR", groupName: "Feo", categoryName: "intenso" },
  { officialCode: "CC1704", officialName: "Feo Vermelho Nevado",  abbreviation: "FE VM NV", modality: "COR", groupName: "Feo", categoryName: "nevado" },
  // ── Ágata Opalino ─────────────────────────────────────────────────────────
  { officialCode: "CC1801", officialName: "Ágata Opalino Amarelo Intenso",  abbreviation: "AG OP AM IN", modality: "COR", groupName: "Ágata Opalino", categoryName: "intenso" },
  { officialCode: "CC1802", officialName: "Ágata Opalino Amarelo Nevado",   abbreviation: "AG OP AM NV", modality: "COR", groupName: "Ágata Opalino", categoryName: "nevado" },
  { officialCode: "CC1803", officialName: "Ágata Opalino Vermelho Intenso", abbreviation: "AG OP VM IN", modality: "COR", groupName: "Ágata Opalino", categoryName: "intenso" },
  { officialCode: "CC1804", officialName: "Ágata Opalino Vermelho Nevado",  abbreviation: "AG OP VM NV", modality: "COR", groupName: "Ágata Opalino", categoryName: "nevado" },
  // ── Canela Opalino ────────────────────────────────────────────────────────
  { officialCode: "CC1901", officialName: "Canela Opalino Amarelo Intenso",  abbreviation: "CN OP AM IN", modality: "COR", groupName: "Canela Opalino", categoryName: "intenso" },
  { officialCode: "CC1902", officialName: "Canela Opalino Amarelo Nevado",   abbreviation: "CN OP AM NV", modality: "COR", groupName: "Canela Opalino", categoryName: "nevado" },
  { officialCode: "CC1903", officialName: "Canela Opalino Vermelho Intenso", abbreviation: "CN OP VM IN", modality: "COR", groupName: "Canela Opalino", categoryName: "intenso" },
  { officialCode: "CC1904", officialName: "Canela Opalino Vermelho Nevado",  abbreviation: "CN OP VM NV", modality: "COR", groupName: "Canela Opalino", categoryName: "nevado" },
  // ── Lizard ────────────────────────────────────────────────────────────────
  { officialCode: "CC2001", officialName: "Lizard Ouro Intenso",  abbreviation: "LZ OU IN", modality: "COR", groupName: "Lizard", subgroupName: "Ouro",  categoryName: "intenso" },
  { officialCode: "CC2002", officialName: "Lizard Ouro Nevado",   abbreviation: "LZ OU NV", modality: "COR", groupName: "Lizard", subgroupName: "Ouro",  categoryName: "nevado" },
  { officialCode: "CC2003", officialName: "Lizard Prata Intenso", abbreviation: "LZ PR IN", modality: "COR", groupName: "Lizard", subgroupName: "Prata", categoryName: "intenso" },
  { officialCode: "CC2004", officialName: "Lizard Prata Nevado",  abbreviation: "LZ PR NV", modality: "COR", groupName: "Lizard", subgroupName: "Prata", categoryName: "nevado" },
];

// ============================================================================
// Catálogo de Canário de Porte (FOB/OBJO — PORTE)
// ============================================================================
const PORTE_CLASSES: SeedClass[] = [
  // ── Gloster ───────────────────────────────────────────────────────────────
  { officialCode: "CP0101", officialName: "Gloster Corona Amarelo Intenso",   abbreviation: "GL CO AM IN", modality: "PORTE", breedName: "Gloster", subgroupName: "Corona",  categoryName: "intenso" },
  { officialCode: "CP0102", officialName: "Gloster Corona Amarelo Nevado",    abbreviation: "GL CO AM NV", modality: "PORTE", breedName: "Gloster", subgroupName: "Corona",  categoryName: "nevado" },
  { officialCode: "CP0103", officialName: "Gloster Corona Vermelho Intenso",  abbreviation: "GL CO VM IN", modality: "PORTE", breedName: "Gloster", subgroupName: "Corona",  categoryName: "intenso" },
  { officialCode: "CP0104", officialName: "Gloster Corona Vermelho Nevado",   abbreviation: "GL CO VM NV", modality: "PORTE", breedName: "Gloster", subgroupName: "Corona",  categoryName: "nevado" },
  { officialCode: "CP0105", officialName: "Gloster Corona Branco",            abbreviation: "GL CO BR",    modality: "PORTE", breedName: "Gloster", subgroupName: "Corona" },
  { officialCode: "CP0111", officialName: "Gloster Consort Amarelo Intenso",  abbreviation: "GL CS AM IN", modality: "PORTE", breedName: "Gloster", subgroupName: "Consort", categoryName: "intenso" },
  { officialCode: "CP0112", officialName: "Gloster Consort Amarelo Nevado",   abbreviation: "GL CS AM NV", modality: "PORTE", breedName: "Gloster", subgroupName: "Consort", categoryName: "nevado" },
  { officialCode: "CP0113", officialName: "Gloster Consort Vermelho Intenso", abbreviation: "GL CS VM IN", modality: "PORTE", breedName: "Gloster", subgroupName: "Consort", categoryName: "intenso" },
  { officialCode: "CP0114", officialName: "Gloster Consort Vermelho Nevado",  abbreviation: "GL CS VM NV", modality: "PORTE", breedName: "Gloster", subgroupName: "Consort", categoryName: "nevado" },
  { officialCode: "CP0115", officialName: "Gloster Consort Branco",           abbreviation: "GL CS BR",    modality: "PORTE", breedName: "Gloster", subgroupName: "Consort" },
  // ── Holandês ──────────────────────────────────────────────────────────────
  { officialCode: "CP0201", officialName: "Holandês Amarelo Intenso",  abbreviation: "HL AM IN", modality: "PORTE", breedName: "Holandês", categoryName: "intenso" },
  { officialCode: "CP0202", officialName: "Holandês Amarelo Nevado",   abbreviation: "HL AM NV", modality: "PORTE", breedName: "Holandês", categoryName: "nevado" },
  { officialCode: "CP0203", officialName: "Holandês Vermelho Intenso", abbreviation: "HL VM IN", modality: "PORTE", breedName: "Holandês", categoryName: "intenso" },
  { officialCode: "CP0204", officialName: "Holandês Vermelho Nevado",  abbreviation: "HL VM NV", modality: "PORTE", breedName: "Holandês", categoryName: "nevado" },
  { officialCode: "CP0205", officialName: "Holandês Branco",           abbreviation: "HL BR",    modality: "PORTE", breedName: "Holandês" },
  // ── Padovano ──────────────────────────────────────────────────────────────
  { officialCode: "CP0230", officialName: "Padovano com Topete Amarelo Intenso",         abbreviation: "PA CT AM IN", modality: "PORTE", breedName: "Padovano", subgroupName: "Com Topete",  categoryName: "intenso" },
  { officialCode: "CP0231", officialName: "Padovano com Topete Amarelo Nevado",          abbreviation: "PA CT AM NV", modality: "PORTE", breedName: "Padovano", subgroupName: "Com Topete",  categoryName: "nevado" },
  { officialCode: "CP0232", officialName: "Padovano com Topete Vermelho Intenso",        abbreviation: "PA CT VM IN", modality: "PORTE", breedName: "Padovano", subgroupName: "Com Topete",  categoryName: "intenso" },
  { officialCode: "CP0233", officialName: "Padovano com Topete Vermelho Nevado",         abbreviation: "PA CT VM NV", modality: "PORTE", breedName: "Padovano", subgroupName: "Com Topete",  categoryName: "nevado" },
  { officialCode: "CP0240", officialName: "Padovano com Topete Branco 100% Lipocrômico", abbreviation: "PA CT BR LI", modality: "PORTE", breedName: "Padovano", subgroupName: "Com Topete" },
  { officialCode: "CP0250", officialName: "Padovano sem Topete Amarelo Intenso",         abbreviation: "PA ST AM IN", modality: "PORTE", breedName: "Padovano", subgroupName: "Sem Topete",  categoryName: "intenso" },
  { officialCode: "CP0251", officialName: "Padovano sem Topete Amarelo Nevado",          abbreviation: "PA ST AM NV", modality: "PORTE", breedName: "Padovano", subgroupName: "Sem Topete",  categoryName: "nevado" },
  { officialCode: "CP0252", officialName: "Padovano sem Topete Vermelho Intenso",        abbreviation: "PA ST VM IN", modality: "PORTE", breedName: "Padovano", subgroupName: "Sem Topete",  categoryName: "intenso" },
  { officialCode: "CP0253", officialName: "Padovano sem Topete Vermelho Nevado",         abbreviation: "PA ST VM NV", modality: "PORTE", breedName: "Padovano", subgroupName: "Sem Topete",  categoryName: "nevado" },
  // ── Frisado do Norte ──────────────────────────────────────────────────────
  { officialCode: "CP0301", officialName: "Frisado do Norte Amarelo Intenso",  abbreviation: "FN AM IN", modality: "PORTE", breedName: "Frisado do Norte", categoryName: "intenso" },
  { officialCode: "CP0302", officialName: "Frisado do Norte Amarelo Nevado",   abbreviation: "FN AM NV", modality: "PORTE", breedName: "Frisado do Norte", categoryName: "nevado" },
  { officialCode: "CP0303", officialName: "Frisado do Norte Vermelho Intenso", abbreviation: "FN VM IN", modality: "PORTE", breedName: "Frisado do Norte", categoryName: "intenso" },
  { officialCode: "CP0304", officialName: "Frisado do Norte Vermelho Nevado",  abbreviation: "FN VM NV", modality: "PORTE", breedName: "Frisado do Norte", categoryName: "nevado" },
  { officialCode: "CP0305", officialName: "Frisado do Norte Branco",           abbreviation: "FN BR",    modality: "PORTE", breedName: "Frisado do Norte" },
  // ── Frisado do Sul ────────────────────────────────────────────────────────
  { officialCode: "CP0401", officialName: "Frisado do Sul Amarelo Intenso",  abbreviation: "FS AM IN", modality: "PORTE", breedName: "Frisado do Sul", categoryName: "intenso" },
  { officialCode: "CP0402", officialName: "Frisado do Sul Amarelo Nevado",   abbreviation: "FS AM NV", modality: "PORTE", breedName: "Frisado do Sul", categoryName: "nevado" },
  { officialCode: "CP0403", officialName: "Frisado do Sul Vermelho Intenso", abbreviation: "FS VM IN", modality: "PORTE", breedName: "Frisado do Sul", categoryName: "intenso" },
  { officialCode: "CP0404", officialName: "Frisado do Sul Vermelho Nevado",  abbreviation: "FS VM NV", modality: "PORTE", breedName: "Frisado do Sul", categoryName: "nevado" },
  { officialCode: "CP0405", officialName: "Frisado do Sul Branco",           abbreviation: "FS BR",    modality: "PORTE", breedName: "Frisado do Sul" },
  // ── Belga Clássico ────────────────────────────────────────────────────────
  { officialCode: "CP0501", officialName: "Belga Clássico Amarelo Intenso",  abbreviation: "BC AM IN", modality: "PORTE", breedName: "Belga Clássico", categoryName: "intenso" },
  { officialCode: "CP0502", officialName: "Belga Clássico Amarelo Nevado",   abbreviation: "BC AM NV", modality: "PORTE", breedName: "Belga Clássico", categoryName: "nevado" },
  { officialCode: "CP0503", officialName: "Belga Clássico Vermelho Intenso", abbreviation: "BC VM IN", modality: "PORTE", breedName: "Belga Clássico", categoryName: "intenso" },
  { officialCode: "CP0504", officialName: "Belga Clássico Vermelho Nevado",  abbreviation: "BC VM NV", modality: "PORTE", breedName: "Belga Clássico", categoryName: "nevado" },
  { officialCode: "CP0505", officialName: "Belga Clássico Branco",           abbreviation: "BC BR",    modality: "PORTE", breedName: "Belga Clássico" },
  // ── Yorkshire ─────────────────────────────────────────────────────────────
  { officialCode: "CP0601", officialName: "Yorkshire Amarelo Intenso",  abbreviation: "YK AM IN", modality: "PORTE", breedName: "Yorkshire", categoryName: "intenso" },
  { officialCode: "CP0602", officialName: "Yorkshire Amarelo Nevado",   abbreviation: "YK AM NV", modality: "PORTE", breedName: "Yorkshire", categoryName: "nevado" },
  { officialCode: "CP0603", officialName: "Yorkshire Vermelho Intenso", abbreviation: "YK VM IN", modality: "PORTE", breedName: "Yorkshire", categoryName: "intenso" },
  { officialCode: "CP0604", officialName: "Yorkshire Vermelho Nevado",  abbreviation: "YK VM NV", modality: "PORTE", breedName: "Yorkshire", categoryName: "nevado" },
  { officialCode: "CP0605", officialName: "Yorkshire Branco",           abbreviation: "YK BR",    modality: "PORTE", breedName: "Yorkshire" },
  // ── Border Fancy ──────────────────────────────────────────────────────────
  { officialCode: "CP0701", officialName: "Border Fancy Amarelo Intenso",  abbreviation: "BD AM IN", modality: "PORTE", breedName: "Border Fancy", categoryName: "intenso" },
  { officialCode: "CP0702", officialName: "Border Fancy Amarelo Nevado",   abbreviation: "BD AM NV", modality: "PORTE", breedName: "Border Fancy", categoryName: "nevado" },
  { officialCode: "CP0703", officialName: "Border Fancy Vermelho Intenso", abbreviation: "BD VM IN", modality: "PORTE", breedName: "Border Fancy", categoryName: "intenso" },
  { officialCode: "CP0704", officialName: "Border Fancy Vermelho Nevado",  abbreviation: "BD VM NV", modality: "PORTE", breedName: "Border Fancy", categoryName: "nevado" },
  { officialCode: "CP0705", officialName: "Border Fancy Branco",           abbreviation: "BD BR",    modality: "PORTE", breedName: "Border Fancy" },
  // ── Norwich ───────────────────────────────────────────────────────────────
  { officialCode: "CP0801", officialName: "Norwich Amarelo Intenso",  abbreviation: "NW AM IN", modality: "PORTE", breedName: "Norwich", categoryName: "intenso" },
  { officialCode: "CP0802", officialName: "Norwich Amarelo Nevado",   abbreviation: "NW AM NV", modality: "PORTE", breedName: "Norwich", categoryName: "nevado" },
  { officialCode: "CP0803", officialName: "Norwich Vermelho Intenso", abbreviation: "NW VM IN", modality: "PORTE", breedName: "Norwich", categoryName: "intenso" },
  { officialCode: "CP0804", officialName: "Norwich Vermelho Nevado",  abbreviation: "NW VM NV", modality: "PORTE", breedName: "Norwich", categoryName: "nevado" },
  { officialCode: "CP0805", officialName: "Norwich Branco",           abbreviation: "NW BR",    modality: "PORTE", breedName: "Norwich" },
  // ── Fife Fancy ────────────────────────────────────────────────────────────
  { officialCode: "CP0901", officialName: "Fife Fancy Amarelo Intenso",  abbreviation: "FF AM IN", modality: "PORTE", breedName: "Fife Fancy", categoryName: "intenso" },
  { officialCode: "CP0902", officialName: "Fife Fancy Amarelo Nevado",   abbreviation: "FF AM NV", modality: "PORTE", breedName: "Fife Fancy", categoryName: "nevado" },
  { officialCode: "CP0903", officialName: "Fife Fancy Vermelho Intenso", abbreviation: "FF VM IN", modality: "PORTE", breedName: "Fife Fancy", categoryName: "intenso" },
  { officialCode: "CP0904", officialName: "Fife Fancy Vermelho Nevado",  abbreviation: "FF VM NV", modality: "PORTE", breedName: "Fife Fancy", categoryName: "nevado" },
  { officialCode: "CP0905", officialName: "Fife Fancy Branco",           abbreviation: "FF BR",    modality: "PORTE", breedName: "Fife Fancy" },
  // ── Lancashire ────────────────────────────────────────────────────────────
  { officialCode: "CP1001", officialName: "Lancashire Coppy Amarelo Intenso",  abbreviation: "LC CO AM IN", modality: "PORTE", breedName: "Lancashire", subgroupName: "Coppy",     categoryName: "intenso" },
  { officialCode: "CP1002", officialName: "Lancashire Coppy Amarelo Nevado",   abbreviation: "LC CO AM NV", modality: "PORTE", breedName: "Lancashire", subgroupName: "Coppy",     categoryName: "nevado" },
  { officialCode: "CP1011", officialName: "Lancashire Plainhead Amarelo Intenso", abbreviation: "LC PH AM IN", modality: "PORTE", breedName: "Lancashire", subgroupName: "Plainhead", categoryName: "intenso" },
  { officialCode: "CP1012", officialName: "Lancashire Plainhead Amarelo Nevado",  abbreviation: "LC PH AM NV", modality: "PORTE", breedName: "Lancashire", subgroupName: "Plainhead", categoryName: "nevado" },
  // ── Scots Fancy ───────────────────────────────────────────────────────────
  { officialCode: "CP1101", officialName: "Scots Fancy Amarelo Intenso",  abbreviation: "SC AM IN", modality: "PORTE", breedName: "Scots Fancy", categoryName: "intenso" },
  { officialCode: "CP1102", officialName: "Scots Fancy Amarelo Nevado",   abbreviation: "SC AM NV", modality: "PORTE", breedName: "Scots Fancy", categoryName: "nevado" },
  { officialCode: "CP1103", officialName: "Scots Fancy Vermelho Intenso", abbreviation: "SC VM IN", modality: "PORTE", breedName: "Scots Fancy", categoryName: "intenso" },
  { officialCode: "CP1104", officialName: "Scots Fancy Vermelho Nevado",  abbreviation: "SC VM NV", modality: "PORTE", breedName: "Scots Fancy", categoryName: "nevado" },
  // ── Crest (Crestado Antigo) ───────────────────────────────────────────────
  { officialCode: "CP1201", officialName: "Crest Coppy Amarelo Intenso",     abbreviation: "CR CO AM IN", modality: "PORTE", breedName: "Crest", subgroupName: "Coppy",     categoryName: "intenso" },
  { officialCode: "CP1202", officialName: "Crest Coppy Amarelo Nevado",      abbreviation: "CR CO AM NV", modality: "PORTE", breedName: "Crest", subgroupName: "Coppy",     categoryName: "nevado" },
  { officialCode: "CP1211", officialName: "Crest Plainhead Amarelo Intenso", abbreviation: "CR PH AM IN", modality: "PORTE", breedName: "Crest", subgroupName: "Plainhead", categoryName: "intenso" },
  { officialCode: "CP1212", officialName: "Crest Plainhead Amarelo Nevado",  abbreviation: "CR PH AM NV", modality: "PORTE", breedName: "Crest", subgroupName: "Plainhead", categoryName: "nevado" },
  // ── Frisado Parisiense ────────────────────────────────────────────────────
  { officialCode: "CP1301", officialName: "Frisado Parisiense Amarelo Intenso",  abbreviation: "FP AM IN", modality: "PORTE", breedName: "Frisado Parisiense", categoryName: "intenso" },
  { officialCode: "CP1302", officialName: "Frisado Parisiense Amarelo Nevado",   abbreviation: "FP AM NV", modality: "PORTE", breedName: "Frisado Parisiense", categoryName: "nevado" },
  { officialCode: "CP1303", officialName: "Frisado Parisiense Vermelho Intenso", abbreviation: "FP VM IN", modality: "PORTE", breedName: "Frisado Parisiense", categoryName: "intenso" },
  { officialCode: "CP1304", officialName: "Frisado Parisiense Vermelho Nevado",  abbreviation: "FP VM NV", modality: "PORTE", breedName: "Frisado Parisiense", categoryName: "nevado" },
  // ── Belga Antigo ──────────────────────────────────────────────────────────
  { officialCode: "CP1401", officialName: "Belga Antigo Amarelo Intenso",  abbreviation: "BA AM IN", modality: "PORTE", breedName: "Belga Antigo", categoryName: "intenso" },
  { officialCode: "CP1402", officialName: "Belga Antigo Amarelo Nevado",   abbreviation: "BA AM NV", modality: "PORTE", breedName: "Belga Antigo", categoryName: "nevado" },
  { officialCode: "CP1403", officialName: "Belga Antigo Vermelho Intenso", abbreviation: "BA VM IN", modality: "PORTE", breedName: "Belga Antigo", categoryName: "intenso" },
  { officialCode: "CP1404", officialName: "Belga Antigo Vermelho Nevado",  abbreviation: "BA VM NV", modality: "PORTE", breedName: "Belga Antigo", categoryName: "nevado" },
];

// ============================================================================
// Função principal de seed
// ============================================================================
export async function seedOfficialClasses(): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] Banco não disponível — seed de classes oficiais ignorado.");
    return { inserted: 0, skipped: 0 };
  }

  const allClasses: SeedClass[] = [...COR_CLASSES, ...PORTE_CLASSES];
  let inserted = 0;
  let skipped = 0;

  for (const cls of allClasses) {
    try {
      // Interpreta os traços genéticos da classe
      let interpretedTraits: unknown = null;
      try {
        interpretedTraits = interpretOfficialClass(cls.officialName, cls.modality);
      } catch {
        // Interpretação falhou — insere sem traços interpretados
      }

      const result = await db
        .insert(official_bird_classes)
        .values({
          officialCode: cls.officialCode,
          officialName: cls.officialName,
          abbreviation: cls.abbreviation,
          modality: cls.modality,
          groupName: cls.groupName,
          subgroupName: cls.subgroupName,
          breedName: cls.breedName,
          bitola: cls.bitola,
          categoryName: cls.categoryName,
          sourceYear: 2026,
          sourceEntity: "FOB/OBJO",
          interpretedTraits: interpretedTraits as Record<string, unknown> | null,
          active: true,
        })
        .onConflictDoNothing()
        .returning({ id: official_bird_classes.id });

      if (result.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`[Seed] Erro ao inserir ${cls.officialCode}:`, error);
      skipped++;
    }
  }

  console.log(`[Seed] Classes oficiais: ${inserted} inseridas, ${skipped} já existiam.`);
  return { inserted, skipped };
}
