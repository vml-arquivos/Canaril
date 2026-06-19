// Armazenamento de arquivos em disco local — substitui a dependência da
// plataforma Manus (Forge/S3) por gravação direta num diretório montado
// como volume persistente no Coolify (Configuration > Persistent Storage).
//
// Por que: este projeto roda inteiramente autogerenciado na VPS do
// criador, sem acesso à infraestrutura Forge da Manus — então as
// credenciais BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY nunca vão
// existir aqui. Gravar em disco, com o diretório apontando para um volume
// persistente, é a forma robusta de garantir que os arquivos sobrevivam a
// redeploys e reinícios do container.
//
// Mantém a mesma assinatura de funções do storage.ts anterior
// (storagePut/storageGet/storageGetSignedUrl) para que nenhum outro
// arquivo do projeto (ex.: server/routers/photos.ts) precise mudar.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ENV } from "./_core/env";

function getUploadsDir(): string {
  const dir = ENV.uploadsDir;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeKey(relKey: string): string {
  // Remove barras iniciais e qualquer ".." pra impedir escapar do diretório
  // de uploads (path traversal).
  return relKey
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const uploadsDir = getUploadsDir();
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(uploadsDir, key);

  // Garante que subpastas (ex.: "bird-12/arquivo.jpg") existam antes de
  // gravar.
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const buffer =
    typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

// Sem conceito de URL assinada/temporária em disco local — todo arquivo em
// /uploads é servido publicamente pela própria aplicação (ver
// server/_core/storageProxy.ts). Mantida apenas para compatibilidade de
// interface com quem já chamava essa função.
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/uploads/${key}`;
}
