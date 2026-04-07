import { Router } from "express";
import path from "path";
import fs from "fs";
import XLSX from "xlsx";
import multer from "multer";
import https from "https";
import http from "http";
import { logger } from "../lib/logger.js";

const DATA_FILE = path.resolve(process.cwd(), "data/fuel-subsidy.xlsx");
const upload = multer({ dest: "/tmp/fuel-uploads/" });

function readWorkbook() {
  return XLSX.readFile(DATA_FILE);
}

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/* ── URL resolver ─────────────────────────────────────────────────────── */
function resolveDownloadUrl(rawUrl: string, sourceType: string): string {
  if (sourceType === "googledrive") {
    const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/uc?export=download&confirm=t&id=${match[1]}`;
    const idMatch = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://drive.google.com/uc?export=download&confirm=t&id=${idMatch[1]}`;
  }
  if (sourceType === "onedrive") {
    if (!rawUrl.includes("download=1"))
      return rawUrl.includes("?") ? `${rawUrl}&download=1` : `${rawUrl}?download=1`;
  }
  if (sourceType === "sharepoint") {
    if (!rawUrl.includes("download=1"))
      return rawUrl.includes("?") ? `${rawUrl}&download=1` : `${rawUrl}?download=1`;
  }
  return rawUrl;
}

/* ── SharePoint Online ROPC token ─────────────────────────────────────── */
async function getSharePointToken(
  spUrl: string,
  username: string,
  password: string,
): Promise<string | null> {
  try {
    const host = new URL(spUrl).hostname; // e.g. pdame-my.sharepoint.com
    const tenantPart = host.split(".")[0].replace(/-my$/, ""); // pdame
    const tenant = `${tenantPart}.onmicrosoft.com`;
    const resource = `https://${host.split(".").slice(0, -2).join(".")}.sharepoint.com`;

    // Use well-known public client that supports ROPC (Azure AD PowerShell)
    const CLIENT_ID = "1950a258-227b-4e31-a9cf-717495945fc2";

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: CLIENT_ID,
      username,
      password,
      scope: `${resource}/.default`,
      resource,
    });

    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/token`;
    const tokenData = await postForm(tokenUrl, body.toString());
    const parsed = JSON.parse(tokenData);
    if (parsed.access_token) return parsed.access_token as string;
    logger.warn({ parsed }, "ROPC token request returned no access_token");
    return null;
  } catch (err) {
    logger.warn({ err }, "ROPC token fetch failed, will fall back to Basic Auth");
    return null;
  }
}

/* ── HTTP helpers ─────────────────────────────────────────────────────── */
function postForm(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0",
      },
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString()));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildHeaders(
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  return { "User-Agent": "Mozilla/5.0", ...extraHeaders };
}

function downloadFile(
  url: string,
  extraHeaders: Record<string, string> = {},
  redirectCount = 0,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) { reject(new Error("Too many redirects")); return; }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    const protocol = url.startsWith("https") ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: parsed.pathname + parsed.search,
      headers: buildHeaders(extraHeaders),
    };

    protocol.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith("http")) {
          next = `${parsed.protocol}//${parsed.host}${next.startsWith("/") ? "" : "/"}${next}`;
        }
        resolve(downloadFile(next, extraHeaders, redirectCount + 1));
        return;
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        reject(new Error(`HTTP ${res.statusCode}: Authentication required or access denied`));
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const router = Router();

/* ── GET /summary ─────────────────────────────────────────────────────── */
router.get("/summary", (_req, res) => {
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets["PM Dashboard"];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
    const lastUpdated = String(data[3]?.[6] ?? "");
    const row7 = (data[7] as unknown[]) ?? [];
    const row8 = (data[8] as unknown[]) ?? [];
    res.json({
      lastUpdated,
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
  } catch (err) {
    logger.error({ err }, "Error reading fuel summary");
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

/* ── GET /province-overview ───────────────────────────────────────────── */
router.get("/province-overview", (_req, res) => {
  try {
    const wb = readWorkbook();
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
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Error reading province overview");
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

/* ── GET /vehicle-breakdown ───────────────────────────────────────────── */
router.get("/vehicle-breakdown", (_req, res) => {
  try {
    const wb = readWorkbook();
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
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Error reading vehicle breakdown");
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

/* ── GET /recd-from-eto ───────────────────────────────────────────────── */
router.get("/recd-from-eto", (_req, res) => {
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets["Recd from ETO"];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
    const rows = [];
    let currentProvince = "";
    for (let i = 3; i < data.length; i++) {
      const row = (data[i] as unknown[]) ?? [];
      if (row[0] !== null && row[0] !== undefined && String(row[0]).trim()) {
        currentProvince = String(row[0]).trim();
      }
      const vehicleType = String(row[1] ?? "").trim();
      if (!vehicleType || vehicleType.toLowerCase() === "total") continue;
      const total = safeNum(row[2]);
      if (total === 0 && safeNum(row[3]) === 0 && safeNum(row[4]) === 0) continue;
      rows.push({ province: currentProvince, vehicleType, total, cnic: safeNum(row[3]), ntn: safeNum(row[4]) });
    }
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Error reading recd from ETO");
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

/* ── POST /upload ─────────────────────────────────────────────────────── */
router.post("/upload", upload.single("file"), (req, res): void => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: "No file uploaded" }); return; }
    const { originalname, path: tmpPath } = req.file;
    if (!originalname.endsWith(".xlsx") && !originalname.endsWith(".xls")) {
      fs.unlinkSync(tmpPath);
      res.status(400).json({ success: false, message: "Only Excel files (.xlsx, .xls) are accepted" });
      return;
    }
    fs.copyFileSync(tmpPath, DATA_FILE);
    fs.unlinkSync(tmpPath);
    res.json({ success: true, message: "Excel file updated successfully" });
  } catch (err) {
    logger.error({ err }, "Error uploading Excel file");
    res.status(500).json({ success: false, message: "Failed to process upload" });
  }
});

/* ── POST /fetch-from-url ─────────────────────────────────────────────── */
router.post("/fetch-from-url", async (req, res): Promise<void> => {
  try {
    const {
      url,
      sourceType,
      username,
      password,
    } = req.body as { url: string; sourceType: string; username?: string; password?: string };

    if (!url) { res.status(400).json({ success: false, message: "URL is required" }); return; }

    const downloadUrl = resolveDownloadUrl(url, sourceType || "direct");
    const hasCredentials = !!(username && password);

    logger.info({ sourceType, hasCredentials, downloadUrl }, "Fetching Excel from URL");

    let extraHeaders: Record<string, string> = {};
    let buffer: Buffer;

    if (hasCredentials) {
      if (sourceType === "sharepoint" || sourceType === "onedrive") {
        /* ── Try SharePoint Online OAuth (ROPC) first ── */
        const token = await getSharePointToken(downloadUrl, username!, password!);
        if (token) {
          logger.info("Using SharePoint OAuth Bearer token");
          extraHeaders = { Authorization: `Bearer ${token}` };
          try {
            buffer = await downloadFile(downloadUrl, extraHeaders);
          } catch (oauthErr: any) {
            logger.warn({ oauthErr }, "Bearer token download failed, falling back to Basic Auth");
            extraHeaders = {
              Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
            };
            buffer = await downloadFile(downloadUrl, extraHeaders);
          }
        } else {
          /* ── Fall back to Basic Auth ── */
          logger.info("ROPC failed, using Basic Auth for SharePoint");
          extraHeaders = {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
          };
          buffer = await downloadFile(downloadUrl, extraHeaders);
        }
      } else {
        /* ── Standard Basic Auth for other sources ── */
        extraHeaders = {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        };
        buffer = await downloadFile(downloadUrl, extraHeaders);
      }
    } else {
      buffer = await downloadFile(downloadUrl, {});
    }

    if (buffer.length < 100) {
      res.status(400).json({ success: false, message: "Downloaded file appears empty or invalid. If the file requires login, please provide credentials." });
      return;
    }

    try {
      XLSX.read(buffer, { type: "buffer" });
    } catch {
      res.status(400).json({ success: false, message: "Downloaded content is not a valid Excel file. Check that the URL points directly to an .xlsx file." });
      return;
    }

    fs.writeFileSync(DATA_FILE, buffer);
    res.json({ success: true, message: "Dashboard data refreshed successfully from remote source." });
  } catch (err: any) {
    logger.error({ err }, "Error fetching from URL");
    const msg = err?.message || "Unknown error";
    const hint = msg.includes("401") || msg.includes("403")
      ? " — Access denied. Please check your credentials or ensure the file is shared correctly."
      : "";
    res.status(500).json({ success: false, message: `Failed to fetch file: ${msg}${hint}` });
  }
});

export default router;
