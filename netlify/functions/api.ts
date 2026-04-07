/**
 * Netlify Serverless Function — Fuel Subsidy Dashboard API
 * Handles all /api/* routes for the Pakistan PM Office Dashboard.
 *
 * Data strategy:
 *  • Initial Excel data is embedded as base64 in initial-data.ts at build time.
 *  • Uploads/URL-fetches write to Netlify Blobs (persistent) and /tmp (per-instance).
 *  • Reads try: Netlify Blobs → /tmp cache → embedded initial data.
 */

import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import XLSX from "xlsx";
import { getStore } from "@netlify/blobs";
import { INITIAL_DATA } from "./initial-data.js";

/* ── Data resolution ─────────────────────────────────────────────────── */

const TMP_PATH = "/tmp/fuel-subsidy.xlsx";
const BLOBS_KEY = "excel";

// Decoded at startup — always available if embedded correctly
const INITIAL_BUFFER: Buffer | null = INITIAL_DATA
  ? Buffer.from(INITIAL_DATA, "base64")
  : null;

// In-memory cache for the current Lambda instance
let instanceBuffer: Buffer | null = null;

async function getExcelBuffer(): Promise<Buffer> {
  // 1. In-memory (fastest, same invocation or warm instance)
  if (instanceBuffer) return instanceBuffer;

  // 2. Netlify Blobs (persistent across deploys, written after upload)
  try {
    const store = getStore("fuel-data");
    const blob = await store.get(BLOBS_KEY, { type: "arrayBuffer" });
    if (blob && blob.byteLength > 100) {
      instanceBuffer = Buffer.from(blob);
      return instanceBuffer;
    }
  } catch {
    // Blobs not configured or unavailable — continue to fallbacks
  }

  // 3. /tmp cache (written by a previous warm invocation of this instance)
  try {
    if (fs.existsSync(TMP_PATH)) {
      const buf = fs.readFileSync(TMP_PATH);
      if (buf.length > 100) {
        instanceBuffer = buf;
        return instanceBuffer;
      }
    }
  } catch { /* ignore */ }

  // 4. Embedded initial data (always available — bundled at build time)
  if (INITIAL_BUFFER && INITIAL_BUFFER.length > 100) {
    return INITIAL_BUFFER;
  }

  throw new Error(
    "No Excel data available. Please upload a fuel-subsidy.xlsx file via the dashboard.",
  );
}

async function saveExcelBuffer(buf: Buffer): Promise<void> {
  // Always update in-memory cache
  instanceBuffer = buf;

  // Write to /tmp for warm invocations
  try { fs.writeFileSync(TMP_PATH, buf); } catch { /* ignore */ }

  // Persist to Netlify Blobs for cross-invocation durability
  try {
    const store = getStore("fuel-data");
    await store.set(BLOBS_KEY, buf);
  } catch {
    // Blobs unavailable — in-memory + /tmp only (ephemeral but functional)
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function err(message: string, status = 500): Response {
  return json({ success: false, message }, status);
}

/* ── URL download helpers ────────────────────────────────────────────── */

function resolveDownloadUrl(rawUrl: string, sourceType: string): string {
  if (sourceType === "googledrive") {
    const m = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=download&confirm=t&id=${m[1]}`;
    const m2 = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return `https://drive.google.com/uc?export=download&confirm=t&id=${m2[1]}`;
  }
  if (sourceType === "onedrive" || sourceType === "sharepoint") {
    if (!rawUrl.includes("download=1"))
      return rawUrl.includes("?") ? `${rawUrl}&download=1` : `${rawUrl}?download=1`;
  }
  return rawUrl;
}

function downloadUrl(
  url: string,
  extraHeaders: Record<string, string> = {},
  redirects = 0,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirects > 8) { reject(new Error("Too many redirects")); return; }
    let parsed: URL;
    try { parsed = new URL(url); } catch { reject(new Error(`Invalid URL: ${url}`)); return; }
    const lib = url.startsWith("https") ? https : http;
    lib.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers: { "User-Agent": "Mozilla/5.0", ...extraHeaders },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let next = res.headers.location;
          if (!next.startsWith("http")) next = `${parsed.protocol}//${parsed.host}${next.startsWith("/") ? next : "/" + next}`;
          resolve(downloadUrl(next, extraHeaders, redirects + 1));
          return;
        }
        if (res.statusCode === 401 || res.statusCode === 403) { reject(new Error(`HTTP ${res.statusCode}: Authentication required`)); return; }
        if (res.statusCode && res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    ).on("error", reject);
  });
}

async function getSharePointToken(spUrl: string, username: string, password: string): Promise<string | null> {
  try {
    const host = new URL(spUrl).hostname;
    const tenant = `${host.split(".")[0].replace(/-my$/, "")}.onmicrosoft.com`;
    const resource = `https://${host.split(".").slice(0, -2).join(".")}.sharepoint.com`;
    const CLIENT_ID = "1950a258-227b-4e31-a9cf-717495945fc2";
    const body = new URLSearchParams({ grant_type: "password", client_id: CLIENT_ID, username, password, scope: `${resource}/.default`, resource });
    return new Promise((resolve) => {
      const bodyStr = body.toString();
      const opts = {
        hostname: "login.microsoftonline.com",
        path: `/${tenant}/oauth2/token`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(bodyStr),
          "User-Agent": "Mozilla/5.0",
        },
      };
      const req = https.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString());
            resolve(parsed.access_token || null);
          } catch { resolve(null); }
        });
      });
      req.on("error", () => resolve(null));
      req.write(bodyStr);
      req.end();
    });
  } catch { return null; }
}

/* ── Route handlers ──────────────────────────────────────────────────── */

async function handleSummary(): Promise<Response> {
  const buf = await getExcelBuffer();
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["PM Dashboard"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  const row7 = (data[7] as unknown[]) ?? [];
  const row8 = (data[8] as unknown[]) ?? [];
  return json({
    lastUpdated: String(data[3]?.[6] ?? ""),
    receivedFromEto: safeNum(row7[1]),
    cnic: safeNum(String(row8[1] ?? "").replace(/[^0-9]/g, "")),
    ntn: safeNum(String(row8[2] ?? "").replace(/[^0-9]/g, "")),
    sentToSbp: safeNum(row7[3]),
    returnedBySbp: safeNum(row7[4]),
    balanceWithSbp: safeNum(row7[5]),
    qtyProcessedBySbp: safeNum(row7[6]),
    amountDisbursedBySbp: safeNum(row7[7]),
    qtyPendingWithSbp: safeNum(row7[8]),
  });
}

async function handleProvinceOverview(): Promise<Response> {
  const buf = await getExcelBuffer();
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["PM Dashboard"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  const rows = [];
  for (let i = 12; i <= 19; i++) {
    const row = (data[i] as unknown[]) ?? [];
    const province = String(row[1] ?? "");
    if (!province) continue;
    rows.push({
      province,
      sentToSbp: safeNum(row[2]),
      returnedBySbp: safeNum(row[3]),
      balanceWithSbp: safeNum(row[4]),
      qtyProcessedBySbp: safeNum(row[5]),
      amountDisbursedBySbp: safeNum(row[6]),
      pendingWithSbp: safeNum(row[7]),
    });
  }
  return json(rows);
}

async function handleVehicleBreakdown(): Promise<Response> {
  const buf = await getExcelBuffer();
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["PM Dashboard"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  const rows = [];
  for (let i = 23; i <= 28; i++) {
    const row = (data[i] as unknown[]) ?? [];
    const vehicleType = String(row[1] ?? "");
    if (!vehicleType) continue;
    rows.push({
      vehicleType,
      sentToSbp: safeNum(row[2]),
      returnedBySbp: safeNum(row[3]),
      balanceWithSbp: safeNum(row[4]),
      qtyProcessedBySbp: safeNum(row[5]),
      amountDisbursedBySbp: safeNum(row[6]),
      pendingWithSbp: safeNum(row[7]),
    });
  }
  return json(rows);
}

async function handleRecdFromEto(): Promise<Response> {
  const buf = await getExcelBuffer();
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["Recd from ETO"];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  const rows = [];
  let province = "";
  for (let i = 3; i < data.length; i++) {
    const row = (data[i] as unknown[]) ?? [];
    if (row[0] !== null && row[0] !== undefined && String(row[0]).trim()) province = String(row[0]).trim();
    const vehicleType = String(row[1] ?? "").trim();
    if (!vehicleType || vehicleType.toLowerCase() === "total") continue;
    const total = safeNum(row[2]);
    if (total === 0 && safeNum(row[3]) === 0 && safeNum(row[4]) === 0) continue;
    rows.push({ province, vehicleType, total, cnic: safeNum(row[3]), ntn: safeNum(row[4]) });
  }
  return json(rows);
}

async function handleUpload(req: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Failed to parse upload. Please try again.", 400);
  }
  const file = formData.get("file") as File | null;
  if (!file) return err("No file provided.", 400);
  if (!file.name.match(/\.(xlsx|xls)$/i)) return err("Only Excel files (.xlsx, .xls) are accepted.", 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 100) return err("Uploaded file appears empty.", 400);
  try { XLSX.read(buf, { type: "buffer" }); } catch { return err("Not a valid Excel file.", 400); }
  await saveExcelBuffer(buf);
  return json({ success: true, message: "Excel file uploaded successfully." });
}

async function handleFetchFromUrl(req: Request): Promise<Response> {
  let body: { url?: string; sourceType?: string; username?: string; password?: string };
  try { body = await req.json(); } catch { return err("Invalid JSON body.", 400); }
  const { url: rawUrl, sourceType = "direct", username, password } = body;
  if (!rawUrl) return err("URL is required.", 400);

  const dlUrl = resolveDownloadUrl(rawUrl, sourceType);
  let extraHeaders: Record<string, string> = {};

  if (username && password) {
    if (sourceType === "sharepoint" || sourceType === "onedrive") {
      const token = await getSharePointToken(dlUrl, username, password);
      if (token) extraHeaders = { Authorization: `Bearer ${token}` };
      else extraHeaders = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
    } else {
      extraHeaders = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
    }
  }

  let buf: Buffer;
  try { buf = await downloadUrl(dlUrl, extraHeaders); } catch (e: any) { return err(`Failed to download: ${e?.message}`, 500); }
  if (buf.length < 100) return err("Downloaded file appears empty or requires login credentials.", 400);
  try { XLSX.read(buf, { type: "buffer" }); } catch { return err("Downloaded content is not a valid Excel file.", 400); }
  await saveExcelBuffer(buf);
  return json({ success: true, message: "Data refreshed from remote source." });
}

/* ── Main handler ────────────────────────────────────────────────────── */

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const pathname = new URL(req.url).pathname;

  try {
    if (req.method === "GET" && pathname.endsWith("/healthz"))           return json({ status: "ok" });
    if (req.method === "GET" && pathname.endsWith("/summary"))           return await handleSummary();
    if (req.method === "GET" && pathname.endsWith("/province-overview")) return await handleProvinceOverview();
    if (req.method === "GET" && pathname.endsWith("/vehicle-breakdown")) return await handleVehicleBreakdown();
    if (req.method === "GET" && pathname.endsWith("/recd-from-eto"))     return await handleRecdFromEto();
    if (req.method === "POST" && pathname.endsWith("/upload"))           return await handleUpload(req);
    if (req.method === "POST" && pathname.endsWith("/fetch-from-url"))   return await handleFetchFromUrl(req);
    return json({ error: "Not Found" }, 404);
  } catch (e: any) {
    console.error("[api] Error:", e);
    return err(e?.message || "Unexpected server error.");
  }
}

export const config = {
  path: "/api/*",
};
