/**
 * officialClassesSeed.ts
 *
 * Seed do catálogo oficial FOB/OBJO para a tabela official_bird_classes.
 *
 * IMPORTANTE: todos os códigos abaixo foram transcritos VERBATIM dos PDFs
 * oficiais anexados ("Nomenclatura Oficial - COR" e "Nomenclatura Oficial -
 * PORTE", FOB/OBJO, anuário 2026, data efetiva 02/02/2026) — nenhum código
 * foi inventado. O catálogo oficial completo tem 1469 classes (771 COR +
 * 698 PORTE); este seed cobre uma amostra real e verificada (toda série de
 * melanina, todo lipocromo de base, toda categoria de pena, e todas as 37
 * raças de porte pelo menos uma vez), suficiente para o modo assistido da
 * calculadora funcionar de ponta a ponta. Para completar o catálogo, basta
 * adicionar mais entradas nos arrays abaixo — a estrutura já suporta isso
 * sem nenhuma mudança de schema.
 *
 * REGRA: Este seed é ADITIVO — nunca apaga dados existentes.
 * Usa INSERT ... ON CONFLICT DO NOTHING (via officialCode unique) para ser
 * idempotente — pode rodar em todo boot sem duplicar nem sobrescrever.
 */

import { getDb } from "../db";
import { official_bird_classes } from "../../drizzle/schema";
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
// Canário de Cor — 93 classes reais (toda série de melanina, todo lipocromo
// de base, toda categoria de pena coberta pelo menos uma vez)
// ============================================================================
const COR_CLASSES: SeedClass[] = [
  { officialCode: "CC0101", officialName: "BRANCO", abbreviation: "BR", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Brancos" },
  { officialCode: "CC0102", officialName: "BRANCO DOMINANTE", abbreviation: "BR DO", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Brancos" },
  { officialCode: "CC0103", officialName: "AMARELO INTENSO", abbreviation: "AM IN", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Amarelos", categoryName: "intenso" },
  { officialCode: "CC0104", officialName: "AMARELO NEVADO", abbreviation: "AM NV", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Amarelos", categoryName: "nevado" },
  { officialCode: "CC0105", officialName: "AMARELO MOSAICO MACHO", abbreviation: "AM MS MC", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Amarelos", categoryName: "mosaico_macho" },
  { officialCode: "CC0106", officialName: "AMARELO MOSAICO FÊMEA", abbreviation: "AM MS FM", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Amarelos", categoryName: "mosaico_femea" },
  { officialCode: "CC0107", officialName: "AMARELO MARFIM INTENSO", abbreviation: "AM MF IN", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Marfins", categoryName: "intenso" },
  { officialCode: "CC0108", officialName: "AMARELO MARFIM NEVADO", abbreviation: "AM MF NV", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Marfins", categoryName: "nevado" },
  { officialCode: "CC0109", officialName: "AMARELO MARFIM MOSAICO MACHO", abbreviation: "AM MF MS MC", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Marfins", categoryName: "mosaico_macho" },
  { officialCode: "CC0110", officialName: "AMARELO MARFIM MOSAICO FÊMEA", abbreviation: "AM MF MS FM", modality: "COR", groupName: "Lipocrômicos sem fator", subgroupName: "Marfins", categoryName: "mosaico_femea" },
  { officialCode: "CC0201", officialName: "AMARELO INTENSO ASAS BRANCAS", abbreviation: "AM IN AB", modality: "COR", groupName: "Lipocrômicos sem fator asa branca", subgroupName: "Asas Brancas", categoryName: "intenso" },
  { officialCode: "CC0202", officialName: "AMARELO NEVADO ASAS BRANCAS", abbreviation: "AM NV AB", modality: "COR", groupName: "Lipocrômicos sem fator asa branca", subgroupName: "Asas Brancas", categoryName: "nevado" },
  { officialCode: "CC0205", officialName: "AMARELO MARFIM INTENSO ASAS BRANCAS", abbreviation: "AM MF IN AB", modality: "COR", groupName: "Lipocrômicos sem fator asa branca", subgroupName: "Asas Brancas", categoryName: "intenso" },
  { officialCode: "CC0206", officialName: "AMARELO MARFIM NEVADO ASAS BRANCAS", abbreviation: "AM MF NV AB", modality: "COR", groupName: "Lipocrômicos sem fator asa branca", subgroupName: "Asas Brancas", categoryName: "nevado" },
  { officialCode: "CC0301", officialName: "ALBINO", abbreviation: "AL", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos" },
  { officialCode: "CC0302", officialName: "ALBINO DOMINANTE", abbreviation: "AL DO", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos" },
  { officialCode: "CC0303", officialName: "LUTINO INTENSO", abbreviation: "LU IN", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "intenso" },
  { officialCode: "CC0304", officialName: "LUTINO NEVADO", abbreviation: "LU NV", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "nevado" },
  { officialCode: "CC0305", officialName: "LUTINO MOSAICO MACHO", abbreviation: "LU MS MC", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "mosaico_macho" },
  { officialCode: "CC0306", officialName: "LUTINO MOSAICO FÊMEA", abbreviation: "LU MS FM", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "mosaico_femea" },
  { officialCode: "CC0307", officialName: "LUTINO MARFIM INTENSO", abbreviation: "LU MF IN", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "intenso" },
  { officialCode: "CC0308", officialName: "LUTINO MARFIM NEVADO", abbreviation: "LU MF NV", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "nevado" },
  { officialCode: "CC0309", officialName: "LUTINO MARFIM MOSAICO MACHO", abbreviation: "LU MF MS MC", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "mosaico_macho" },
  { officialCode: "CC0310", officialName: "LUTINO MARFIM MOSAICO FÊMEA", abbreviation: "LU MF MS FM", modality: "COR", groupName: "Ino lipocrômicos sem fator", subgroupName: "Inos", categoryName: "mosaico_femea" },
  { officialCode: "CC0401", officialName: "BICO AMARELO INTENSO", abbreviation: "BA IN", modality: "COR", groupName: "Bico amarelo", subgroupName: "Bico Amarelo", categoryName: "intenso" },
  { officialCode: "CC0402", officialName: "BICO AMARELO NEVADO", abbreviation: "BA NV", modality: "COR", groupName: "Bico amarelo", subgroupName: "Bico Amarelo", categoryName: "nevado" },
  { officialCode: "CC0411", officialName: "BICO AMARELO LUTINO INTENSO", abbreviation: "BA LU IN", modality: "COR", groupName: "Bico amarelo", subgroupName: "Bico Amarelo", categoryName: "intenso" },
  { officialCode: "CC0412", officialName: "BICO AMARELO LUTINO NEVADO", abbreviation: "BA LU NV", modality: "COR", groupName: "Bico amarelo", subgroupName: "Bico Amarelo", categoryName: "nevado" },
  { officialCode: "CC0501", officialName: "VERMELHO INTENSO", abbreviation: "VM IN", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Vermelhos", categoryName: "intenso" },
  { officialCode: "CC0502", officialName: "VERMELHO NEVADO", abbreviation: "VM NV", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Vermelhos", categoryName: "nevado" },
  { officialCode: "CC0503", officialName: "VERMELHO MOSAICO MACHO", abbreviation: "VM MS MC", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Vermelhos", categoryName: "mosaico_macho" },
  { officialCode: "CC0504", officialName: "VERMELHO MOSAICO FÊMEA", abbreviation: "VM MS FM", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Vermelhos", categoryName: "mosaico_femea" },
  { officialCode: "CC0505", officialName: "VERMELHO MARFIM INTENSO", abbreviation: "VM MF IN", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Marfins", categoryName: "intenso" },
  { officialCode: "CC0506", officialName: "VERMELHO MARFIM NEVADO", abbreviation: "VM MF NV", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Marfins", categoryName: "nevado" },
  { officialCode: "CC0507", officialName: "VERMELHO MARFIM MOSAICO MACHO", abbreviation: "VM MF MS MC", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Marfins", categoryName: "mosaico_macho" },
  { officialCode: "CC0508", officialName: "VERMELHO MARFIM MOSAICO FÊMEA", abbreviation: "VM MF MS FM", modality: "COR", groupName: "Lipocrômicos com fator", subgroupName: "Marfins", categoryName: "mosaico_femea" },
  { officialCode: "CC0601", officialName: "VERMELHO INTENSO ASAS BRANCAS", abbreviation: "VM IN AB", modality: "COR", groupName: "Lipocrômicos com fator asa branca", subgroupName: "Asas Brancas", categoryName: "intenso" },
  { officialCode: "CC0602", officialName: "VERMELHO NEVADO ASAS BRANCAS", abbreviation: "VM NV AB", modality: "COR", groupName: "Lipocrômicos com fator asa branca", subgroupName: "Asas Brancas", categoryName: "nevado" },
  { officialCode: "CC0605", officialName: "VERMELHO MARFIM INTENSO ASAS BRANCAS", abbreviation: "VM MF IN AB", modality: "COR", groupName: "Lipocrômicos com fator asa branca", subgroupName: "Asas Brancas", categoryName: "intenso" },
  { officialCode: "CC0606", officialName: "VERMELHO MARFIM NEVADO ASAS BRANCAS", abbreviation: "VM MF NV AB", modality: "COR", groupName: "Lipocrômicos com fator asa branca", subgroupName: "Asas Brancas", categoryName: "nevado" },
  { officialCode: "CC0701", officialName: "RUBINO INTENSO", abbreviation: "RU IN", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "intenso" },
  { officialCode: "CC0702", officialName: "RUBINO NEVADO", abbreviation: "RU NV", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "nevado" },
  { officialCode: "CC0703", officialName: "RUBINO MOSAICO MACHO", abbreviation: "RU MS MC", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "mosaico_macho" },
  { officialCode: "CC0704", officialName: "RUBINO MOSAICO FÊMEA", abbreviation: "RU MS FM", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "mosaico_femea" },
  { officialCode: "CC0705", officialName: "RUBINO MARFIM INTENSO", abbreviation: "RU MF IN", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "intenso" },
  { officialCode: "CC0706", officialName: "RUBINO MARFIM NEVADO", abbreviation: "RU MF NV", modality: "COR", groupName: "Inos lipocrômicos com fator", subgroupName: "Rubinos", categoryName: "nevado" },
  { officialCode: "CC0901", officialName: "URUCUM VERMELHO INTENSO", abbreviation: "UR VM IN", modality: "COR", groupName: "Urucum", subgroupName: "Urucum", categoryName: "intenso" },
  { officialCode: "CC0902", officialName: "URUCUM VERMELHO NEVADO", abbreviation: "UR VM NV", modality: "COR", groupName: "Urucum", subgroupName: "Urucum", categoryName: "nevado" },
  { officialCode: "CC0905", officialName: "URUCUM VERMELHO MARFIM INTENSO", abbreviation: "UR VM MF IN", modality: "COR", groupName: "Urucum", subgroupName: "Urucum", categoryName: "intenso" },
  { officialCode: "CC1101", officialName: "AZUL", abbreviation: "AZ", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro" },
  { officialCode: "CC1102", officialName: "AZUL DOMINANTE", abbreviation: "AZ DO", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro" },
  { officialCode: "CC1103", officialName: "VERDE INTENSO", abbreviation: "VD IN", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "intenso" },
  { officialCode: "CC1104", officialName: "VERDE NEVADO", abbreviation: "VD NV", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "nevado" },
  { officialCode: "CC1105", officialName: "VERDE MOSAICO MACHO", abbreviation: "VD MS MC", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "mosaico_macho" },
  { officialCode: "CC1106", officialName: "VERDE MOSAICO FÊMEA", abbreviation: "VD MS FM", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "mosaico_femea" },
  { officialCode: "CC1107", officialName: "VERDE MARFIM INTENSO", abbreviation: "VD MF IN", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "intenso" },
  { officialCode: "CC1108", officialName: "VERDE MARFIM NEVADO", abbreviation: "VD MF NV", modality: "COR", groupName: "Negros sem fator", subgroupName: "Negro", categoryName: "nevado" },
  { officialCode: "CC1201", officialName: "ÁGATA PRATEADO", abbreviation: "AG PR", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata" },
  { officialCode: "CC1202", officialName: "ÁGATA PRATEADO DOMINANTE", abbreviation: "AG PR DO", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata" },
  { officialCode: "CC1203", officialName: "ÁGATA AMARELO INTENSO", abbreviation: "AG AM IN", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata", categoryName: "intenso" },
  { officialCode: "CC1204", officialName: "ÁGATA AMARELO NEVADO", abbreviation: "AG AM NV", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata", categoryName: "nevado" },
  { officialCode: "CC1205", officialName: "ÁGATA AMARELO MOSAICO MACHO", abbreviation: "AG AM MS MC", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata", categoryName: "mosaico_macho" },
  { officialCode: "CC1206", officialName: "ÁGATA AMARELO MOSAICO FÊMEA", abbreviation: "AG AM MS FM", modality: "COR", groupName: "Ágatas sem fator", subgroupName: "Ágata", categoryName: "mosaico_femea" },
  { officialCode: "CC1301", officialName: "CANELA PRATEADO", abbreviation: "CN PR", modality: "COR", groupName: "Canelas sem fator", subgroupName: "Canela" },
  { officialCode: "CC1302", officialName: "CANELA PRATEADO DOMINANTE", abbreviation: "CN PR DO", modality: "COR", groupName: "Canelas sem fator", subgroupName: "Canela" },
  { officialCode: "CC1303", officialName: "CANELA AMARELO INTENSO", abbreviation: "CN AM IN", modality: "COR", groupName: "Canelas sem fator", subgroupName: "Canela", categoryName: "intenso" },
  { officialCode: "CC1304", officialName: "CANELA AMARELO NEVADO", abbreviation: "CN AM NV", modality: "COR", groupName: "Canelas sem fator", subgroupName: "Canela", categoryName: "nevado" },
  { officialCode: "CC1305", officialName: "CANELA AMARELO MOSAICO MACHO", abbreviation: "CN AM MS MC", modality: "COR", groupName: "Canelas sem fator", subgroupName: "Canela", categoryName: "mosaico_macho" },
  { officialCode: "CC1401", officialName: "ISABELINO PRATEADO", abbreviation: "IS PR", modality: "COR", groupName: "Isabelinos sem fator", subgroupName: "Isabelino" },
  { officialCode: "CC1402", officialName: "ISABELINO PRATEADO DOMINANTE", abbreviation: "IS PR DO", modality: "COR", groupName: "Isabelinos sem fator", subgroupName: "Isabelino" },
  { officialCode: "CC1403", officialName: "ISABELINO AMARELO INTENSO", abbreviation: "IS AM IN", modality: "COR", groupName: "Isabelinos sem fator", subgroupName: "Isabelino", categoryName: "intenso" },
  { officialCode: "CC1404", officialName: "ISABELINO AMARELO NEVADO", abbreviation: "IS AM NV", modality: "COR", groupName: "Isabelinos sem fator", subgroupName: "Isabelino", categoryName: "nevado" },
  { officialCode: "CC1501", officialName: "COBRE INTENSO", abbreviation: "CB IN", modality: "COR", groupName: "Negro com fator", subgroupName: "Cobre", categoryName: "intenso" },
  { officialCode: "CC1502", officialName: "COBRE NEVADO", abbreviation: "CB NV", modality: "COR", groupName: "Negro com fator", subgroupName: "Cobre", categoryName: "nevado" },
  { officialCode: "CC1601", officialName: "ÁGATA VERMELHO INTENSO", abbreviation: "AG VM IN", modality: "COR", groupName: "Ágata com fator", subgroupName: "Ágata", categoryName: "intenso" },
  { officialCode: "CC1602", officialName: "ÁGATA VERMELHO NEVADO", abbreviation: "AG VM NV", modality: "COR", groupName: "Ágata com fator", subgroupName: "Ágata", categoryName: "nevado" },
  { officialCode: "CC1701", officialName: "CANELA VERMELHO INTENSO", abbreviation: "CN VM IN", modality: "COR", groupName: "Canela com fator", subgroupName: "Canela", categoryName: "intenso" },
  { officialCode: "CC1702", officialName: "CANELA VERMELHO NEVADO", abbreviation: "CN VM NV", modality: "COR", groupName: "Canela com fator", subgroupName: "Canela", categoryName: "nevado" },
  { officialCode: "CC1801", officialName: "ISABELINO VERMELHO INTENSO", abbreviation: "IS VM IN", modality: "COR", groupName: "Isabelinos com fator", subgroupName: "Isabelino", categoryName: "intenso" },
  { officialCode: "CC1802", officialName: "ISABELINO VERMELHO NEVADO", abbreviation: "IS VM NV", modality: "COR", groupName: "Isabelinos com fator", subgroupName: "Isabelino", categoryName: "nevado" },
  { officialCode: "CC1903", officialName: "VERDE PASTEL INTENSO", abbreviation: "VD PT IN", modality: "COR", groupName: "Negro pastel sem fator", subgroupName: "Pastel", categoryName: "intenso" },
  { officialCode: "CC2003", officialName: "ÁGATA PASTEL AMARELO INTENSO", abbreviation: "AG PT AM IN", modality: "COR", groupName: "Ágata pastel sem fator", subgroupName: "Pastel", categoryName: "intenso" },
  { officialCode: "CC2703", officialName: "VERDE OPALINO INTENSO", abbreviation: "VD OP IN", modality: "COR", groupName: "Negro opalino sem fator", subgroupName: "Opalino", categoryName: "intenso" },
  { officialCode: "CC3501", officialName: "FEO ALBINO MACHO", abbreviation: "FE AL MC", modality: "COR", groupName: "Feo sem fator", subgroupName: "Feo" },
  { officialCode: "CC3703", officialName: "ACETINADO AMARELO INTENSO", abbreviation: "AC AM IN", modality: "COR", groupName: "Acetinado sem fator", subgroupName: "Acetinado", categoryName: "intenso" },
  { officialCode: "CC3903", officialName: "ASAS CINZA AMARELO INTENSO", abbreviation: "AS CZ AM IN", modality: "COR", groupName: "Asas cinza sem fator", subgroupName: "Asas Cinza", categoryName: "intenso" },
  { officialCode: "CC4103", officialName: "VERDE TOPÁZIO INTENSO", abbreviation: "VD TO IN", modality: "COR", groupName: "Negro topázio sem fator", subgroupName: "Topázio", categoryName: "intenso" },
  { officialCode: "CC4903", officialName: "VERDE EUMO INTENSO", abbreviation: "VD EU IN", modality: "COR", groupName: "Negro eumo sem fator", subgroupName: "Eumo", categoryName: "intenso" },
  { officialCode: "CC5703", officialName: "VERDE ONIX INTENSO", abbreviation: "VD OX IN", modality: "COR", groupName: "Negro ônix sem fator", subgroupName: "Ônix", categoryName: "intenso" },
  { officialCode: "CC6503", officialName: "VERDE COBALTO INTENSO", abbreviation: "VD CO IN", modality: "COR", groupName: "Negro cobalto sem fator", subgroupName: "Cobalto", categoryName: "intenso" },
  { officialCode: "CC7303", officialName: "VERDE JASPE INTENSO", abbreviation: "VD JP IN", modality: "COR", groupName: "Negro jaspe sem fator", subgroupName: "Jaspe", categoryName: "intenso" },
  { officialCode: "CC8103", officialName: "VERDE MOGNO INTENSO", abbreviation: "VD MO IN", modality: "COR", groupName: "Negro mogno sem fator", subgroupName: "Mogno", categoryName: "intenso" },
  { officialCode: "CC8803", officialName: "MULATO AMARELO INTENSO", abbreviation: "MU AM IN", modality: "COR", groupName: "Mulatos sem fator", subgroupName: "Mulato", categoryName: "intenso" },
];

// ============================================================================
// Canário de Porte — 45 classes reais (37 raças, todas cobertas; com/sem
// topete onde a raça suporta crista)
// ============================================================================
const PORTE_CLASSES: SeedClass[] = [
  { officialCode: "CP0010", officialName: "FRISADO PARISIENSE BRANCO 100% LIPOCRÔMICO", abbreviation: "FR PR BR LI", modality: "PORTE", breedName: "Frisado Parisiense", bitola: "3,4" },
  { officialCode: "CP0020", officialName: "FRISADO PARISIENSE INTENSO 100% LIPOCRÔMICO", abbreviation: "FR PR IN LI", modality: "PORTE", breedName: "Frisado Parisiense", bitola: "3,4", categoryName: "intenso" },
  { officialCode: "CP0110", officialName: "FRISADO GIGANTE ITALIANO BRANCO 100% LIPOCRÔMICO", abbreviation: "FR GI IT BR LI", modality: "PORTE", breedName: "Frisado Gigante Italiano", bitola: "3,4" },
  { officialCode: "CP0210", officialName: "PADOVANO SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "PA ST BR LI", modality: "PORTE", breedName: "Padovano", bitola: "3,4" },
  { officialCode: "CP0240", officialName: "PADOVANO COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "PA CT BR LI", modality: "PORTE", breedName: "Padovano", bitola: "3,4" },
  { officialCode: "CP0310", officialName: "MELADO TENERIFENHO BRANCO 100% LIPOCRÔMICO", abbreviation: "ME TE BR LI", modality: "PORTE", breedName: "Melado Tenerifenho", bitola: "3,0" },
  { officialCode: "CP0410", officialName: "FRISADO DO NORTE BRANCO 100% LIPOCRÔMICO", abbreviation: "FR NT BR LI", modality: "PORTE", breedName: "Frisado do Norte", bitola: "3,0" },
  { officialCode: "CP0510", officialName: "FRISADO DO SUL BRANCO 100% LIPOCRÔMICO", abbreviation: "FR SL BR LI", modality: "PORTE", breedName: "Frisado do Sul", bitola: "3,0" },
  { officialCode: "CP0610", officialName: "FRISADO SUÍÇO BRANCO 100% LIPOCRÔMICO", abbreviation: "FR SU BR LI", modality: "PORTE", breedName: "Frisado Suíço", bitola: "3,0" },
  { officialCode: "CP0710", officialName: "GIBBER ITALICUS BRANCO 100% LIPOCRÔMICO", abbreviation: "GI IT BR LI", modality: "PORTE", breedName: "Gibber Italicus", bitola: "2,7" },
  { officialCode: "CP0810", officialName: "GIBOSO ESPANHOL BRANCO 100% LIPOCRÔMICO", abbreviation: "GB ES BR LI", modality: "PORTE", breedName: "Giboso Espanhol", bitola: "3,0" },
  { officialCode: "CP0910", officialName: "FIORINO SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "FI ST BR LI", modality: "PORTE", breedName: "Fiorino", bitola: "3,0" },
  { officialCode: "CP0940", officialName: "FIORINO COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "FI CT BR LI", modality: "PORTE", breedName: "Fiorino", bitola: "3,0" },
  { officialCode: "CP1010", officialName: "MEHRINGER BRANCO 100% LIPOCRÔMICO", abbreviation: "MH BR LI", modality: "PORTE", breedName: "Mehringer", bitola: "3,0" },
  { officialCode: "CP1110", officialName: "GIRALDILLO SEVILLANO BRANCO 100% LIPOCROMICO", abbreviation: "GR SE BR LI", modality: "PORTE", breedName: "Giraldillo", bitola: "2,7" },
  { officialCode: "CP1210", officialName: "ROGETTO BRANCO 100% LIPOCRÔMICO", abbreviation: "RO BR LI", modality: "PORTE", breedName: "Rogetto", bitola: "3,0" },
  { officialCode: "CP1310", officialName: "BENACUS SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "BN ST BR LI", modality: "PORTE", breedName: "Benacus", bitola: "3,0" },
  { officialCode: "CP1340", officialName: "BENACUS COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "BN CT BR LI", modality: "PORTE", breedName: "Benacus", bitola: "3,0" },
  { officialCode: "CP2010", officialName: "BOSSU BELGA BRANCO 100% LIPOCRÔMICO", abbreviation: "BS BE BR LI", modality: "PORTE", breedName: "Bossu Belga", bitola: "3,0" },
  { officialCode: "CP2110", officialName: "SCOTCH FANCY BRANCO 100% LIPOCRÔMICO", abbreviation: "SC FA BR LI", modality: "PORTE", breedName: "Scotch Fancy", bitola: "3,0" },
  { officialCode: "CP2210", officialName: "MÜNCHENER BRANCO 100% LIPOCRÔMICO", abbreviation: "MU BR LI", modality: "PORTE", breedName: "Münchener", bitola: "3,0" },
  { officialCode: "CP2310", officialName: "HOSO JAPONÊS BRANCO LIPOCRÔMICO", abbreviation: "HO JA BR LI", modality: "PORTE", breedName: "Hoso Japonês", bitola: "2,7" },
  { officialCode: "CP2410", officialName: "SALENTINO S/TOP BRANCO 100% LIPOCRÔNICO", abbreviation: "SA ST BR LI", modality: "PORTE", breedName: "Salentino", bitola: "2,7" },
  { officialCode: "CP2440", officialName: "SALENTINO C/TOP BRANCO 100% LIPOCRÔNICO", abbreviation: "SA CT BR LI", modality: "PORTE", breedName: "Salentino", bitola: "2,7" },
  { officialCode: "CP3010", officialName: "BORDER BRANCO 100% LIPOCRÔMICO", abbreviation: "BO BR LI", modality: "PORTE", breedName: "Border", bitola: "3,4" },
  { officialCode: "CP3110", officialName: "NORWICH BRANCO 100% LIPOCRÔMICO", abbreviation: "NO BR LI", modality: "PORTE", breedName: "Norwich", bitola: "3,4" },
  { officialCode: "CP3210", officialName: "YORKSHIRE BRANCO 100% LIPOCRÔMICO", abbreviation: "YO BR LI", modality: "PORTE", breedName: "Yorkshire", bitola: "3,4" },
  { officialCode: "CP3310", officialName: "LLARGUET ESPANHOL BRANCO 100% LIPOCRÔMICO", abbreviation: "LL ES BR LI", modality: "PORTE", breedName: "Llarguet Espanhol", bitola: "3,0" },
  { officialCode: "CP3410", officialName: "BERNOIS BRANCO 100% LIPOCRÔMICO", abbreviation: "BE BR LI", modality: "PORTE", breedName: "Bernois", bitola: "3,0" },
  { officialCode: "CP3510", officialName: "FIFE FANCY BRANCO 100% LIPOCRÔMICO", abbreviation: "FI FA BR LI", modality: "PORTE", breedName: "Fife Fancy", bitola: "2,7" },
  { officialCode: "CP3610", officialName: "RAÇA ESPANHOLA BRANCO 100% LIPOCRÔMICO", abbreviation: "RA ES BR LI", modality: "PORTE", breedName: "Raça Espanhola", bitola: "2,5" },
  { officialCode: "CP3710", officialName: "IRISH FANCY BRANCO 100% LIPOCRÔMICO", abbreviation: "IR FA BR LI", modality: "PORTE", breedName: "Irish Fancy", bitola: "2,7" },
  { officialCode: "CP3810", officialName: "RASMI PERSA BRANCO 100% LIPOCRÔMICO", abbreviation: "RM PE BR LI", modality: "PORTE", breedName: "Rasmi Persa", bitola: "3,2" },
  { officialCode: "CP5001", officialName: "LIZARD SEM CÚPULA BRANCO", abbreviation: "LZ SC BR", modality: "PORTE", breedName: "Lizard", bitola: "3,0" },
  { officialCode: "CP5501", officialName: "LONDON FANCY BRANCO", abbreviation: "LF BR", modality: "PORTE", breedName: "London Fancy", bitola: "3,2" },
  { officialCode: "CP6001", officialName: "TOPETE ALEMÃO BRANCO LIPOCRÔMICO", abbreviation: "TO AL BR LI", modality: "PORTE", breedName: "Topete Alemão", bitola: "3,0" },
  { officialCode: "CP7010", officialName: "GLOSTER SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "GL ST BR LI", modality: "PORTE", breedName: "Gloster", bitola: "3,0" },
  { officialCode: "CP7040", officialName: "GLOSTER COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "GL CT BR LI", modality: "PORTE", breedName: "Gloster", bitola: "3,0" },
  { officialCode: "CP7110", officialName: "LANCASHIRE SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "LA ST BR LI", modality: "PORTE", breedName: "Lancashire", bitola: "3,4" },
  { officialCode: "CP7140", officialName: "LANCASHIRE COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "LA CT BR LI", modality: "PORTE", breedName: "Lancashire", bitola: "3,4" },
  { officialCode: "CP7210", officialName: "CREST-BRED BRANCO 100% LIPOCRÔMICO", abbreviation: "CR BD BR LI", modality: "PORTE", breedName: "Crest-Bred", bitola: "3,4" },
  { officialCode: "CP7410", officialName: "RHEINLÄNDER SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "RH ST BR LI", modality: "PORTE", breedName: "Rheinländer", bitola: "2,7" },
  { officialCode: "CP7440", officialName: "RHEINLÄNDER COM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "RH CT BR LI", modality: "PORTE", breedName: "Rheinländer", bitola: "2,7" },
  { officialCode: "CP7701", officialName: "ARLEQUIM PORTUGUÊS SEM TOPETE MACHO", abbreviation: "AR PT ST MC", modality: "PORTE", breedName: "Arlequim Português", bitola: "3,2" },
  { officialCode: "CP8010", officialName: "PÍVARO SEM TOPETE BRANCO 100% LIPOCRÔMICO", abbreviation: "PI ST BR LI", modality: "PORTE", breedName: "Pívaro", bitola: "3,2" },
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
