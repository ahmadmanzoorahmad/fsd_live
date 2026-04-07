import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetFuelSummary,
  useGetFuelProvinceOverview,
  useGetFuelVehicleBreakdown,
  useGetFuelRecdFromEto,
  useUploadFuelExcel,
  useFetchFuelFromUrl,
} from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Download, Printer, Upload, Link2,
  ChevronDown, CheckCircle2, AlertCircle, X,
} from "lucide-react";

/* ─── Pakistan Official Color Palette ─────────────────────────────────── */
const PK = {
  green:     "#01411C",
  greenMid:  "#025A27",
  greenLight:"#1a6b38",
  greenFaint:"#E8F5EE",
  greenBorder:"#b7dfc6",
  gold:      "#C9A84C",
  goldLight: "#F5E6B8",
  white:     "#FFFFFF",
  offWhite:  "#F4F6F5",
  text:      "#1a1a1a",
  textMuted: "#5a6a62",
  border:    "#D6E4DB",
  red:       "#C0392B",
  orange:    "#D35400",
};

const CHART_GREENS = [PK.green, "#2D6A4F", "#52B788", "#74C69D", "#B7E4C7"];
const CHART_GOLD   = [PK.gold, "#E9C46A", "#F4A261", "#E76F51"];

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function fmt(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value);
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ─── Pakistan Crescent-Star SVG ───────────────────────────────────────── */
function PakistanEmblem({ size = 48, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill={PK.green} stroke={color} strokeWidth="2" opacity="0.3" />
      <path
        d="M67 32 C58 22, 38 24, 30 38 C22 52, 28 68, 42 74 C30 70, 22 54, 32 40 C40 28, 58 28, 66 38 Z"
        fill={color}
      />
      <polygon
        points="72,30 74,38 82,38 76,44 78,52 72,47 66,52 68,44 62,38 70,38"
        fill={color}
        transform="rotate(-10, 72, 41)"
      />
    </svg>
  );
}

/* ─── Tooltip ──────────────────────────────────────────────────────────── */
function GovTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: PK.white, border: `1px solid ${PK.border}`,
      borderRadius: 6, padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(1,65,28,0.12)", fontSize: 13,
    }}>
      {label && <p style={{ fontWeight: 600, color: PK.green, marginBottom: 6 }}>{label}</p>}
      {payload.map((item: any, i: number) => (
        <p key={i} style={{ color: PK.text, margin: "2px 0" }}>
          <span style={{ color: item.color, fontWeight: 600 }}>■ </span>
          {item.name}: <strong>{fmt(item.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function GovLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
      {payload.map((entry: any, i: number) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: PK.textMuted }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────────── */
function KPICard({
  title, value, subtitle, loading, accent = PK.green,
}: {
  title: string; value?: number; subtitle?: string; loading: boolean; accent?: string;
}) {
  return (
    <div style={{
      background: PK.white, border: `1px solid ${PK.border}`,
      borderRadius: 8, padding: "20px 22px",
      borderLeft: `4px solid ${accent}`,
      boxShadow: "0 2px 8px rgba(1,65,28,0.06)",
      transition: "box-shadow 0.2s",
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: PK.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </p>
      {loading ? (
        <Skeleton className="h-8 w-24 mt-1" />
      ) : (
        <p style={{ fontSize: 28, fontWeight: 800, color: PK.green, lineHeight: 1.1 }}>{fmt(value)}</p>
      )}
      {subtitle && !loading && (
        <p style={{ fontSize: 11, color: PK.textMuted, marginTop: 4 }}>{subtitle}</p>
      )}
    </div>
  );
}

/* ─── Section Card ─────────────────────────────────────────────────────── */
function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: PK.white, border: `1px solid ${PK.border}`,
      borderRadius: 8, overflow: "hidden",
      boxShadow: "0 2px 8px rgba(1,65,28,0.06)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 22px", borderBottom: `1px solid ${PK.border}`,
        background: PK.white,
      }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: PK.green, margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12, color: PK.textMuted, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

/* ─── Table Styles ─────────────────────────────────────────────────────── */
function GovTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${PK.border}`, borderRadius: 6, fontSize: 13 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
    </div>
  );
}
function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: "10px 14px", textAlign: right ? "right" : "left",
      background: PK.green, color: PK.white,
      fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
      position: "sticky", top: 0, whiteSpace: "nowrap",
    }}>{children}</th>
  );
}
function TD({ children, right, bold, color, mono }: {
  children: React.ReactNode; right?: boolean; bold?: boolean; color?: string; mono?: boolean;
}) {
  return (
    <td style={{
      padding: "9px 14px", textAlign: right ? "right" : "left",
      fontWeight: bold ? 700 : 400, color: color || PK.text,
      fontFamily: mono ? "monospace" : undefined,
      borderBottom: `1px solid ${PK.border}`,
    }}>{children}</td>
  );
}

/* ─── Source Type Config ───────────────────────────────────────────────── */
const SOURCE_TYPES = [
  { value: "googledrive", label: "Google Drive", icon: "🟢", hint: "Paste the 'Share' link from Google Drive" },
  { value: "sharepoint", label: "SharePoint", icon: "🔷", hint: "Paste the shared document URL from SharePoint" },
  { value: "onedrive",   label: "OneDrive",    icon: "☁️",  hint: "Paste the shared link from OneDrive" },
  { value: "direct",     label: "Direct URL",  icon: "🔗",  hint: "Paste a direct .xlsx download URL" },
];

/* ─── Main Dashboard ───────────────────────────────────────────────────── */
export default function Dashboard() {
  const queryClient    = useQueryClient();
  const { toast }      = useToast();
  const now            = useLiveClock();
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const [isSpinning,     setIsSpinning]     = useState(false);
  const [showDataSource, setShowDataSource] = useState(false);
  const [sourceType,     setSourceType]     = useState("googledrive");
  const [sourceUrl,      setSourceUrl]      = useState("");
  const [useAuth,        setUseAuth]        = useState(false);
  const [authUser,       setAuthUser]       = useState("");
  const [authPass,       setAuthPass]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [urlStatus,      setUrlStatus]      = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [urlMsg,         setUrlMsg]         = useState("");

  const summaryQuery  = useGetFuelSummary();
  const provinceQuery = useGetFuelProvinceOverview();
  const vehicleQuery  = useGetFuelVehicleBreakdown();
  const etoQuery      = useGetFuelRecdFromEto();
  const uploadMutation = useUploadFuelExcel();
  const fetchUrlMutation = useFetchFuelFromUrl();

  const loading = summaryQuery.isLoading || provinceQuery.isLoading || vehicleQuery.isLoading || etoQuery.isLoading;

  useEffect(() => {
    if (loading) { setIsSpinning(true); return; }
    const t = setTimeout(() => setIsSpinning(false), 600);
    return () => clearTimeout(t);
  }, [loading]);

  const handleRefresh = useCallback(() => { queryClient.invalidateQueries(); }, [queryClient]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ data: { file } }, {
      onSuccess: () => {
        toast({ title: "Upload successful", description: "Dashboard has been updated with new data." });
        queryClient.invalidateQueries();
      },
      onError: (err: any) => {
        toast({ title: "Upload failed", description: err?.message || "Error uploading file.", variant: "destructive" });
      }
    });
    e.target.value = "";
  };

  const handleFetchFromUrl = () => {
    if (!sourceUrl.trim()) { setUrlStatus("error"); setUrlMsg("Please enter a URL."); return; }
    if (useAuth && (!authUser.trim() || !authPass.trim())) {
      setUrlStatus("error");
      setUrlMsg("Please enter both username and password.");
      return;
    }
    setUrlStatus("loading");
    setUrlMsg("");
    const payload: { url: string; sourceType: string; username?: string; password?: string } = {
      url: sourceUrl.trim(),
      sourceType,
    };
    if (useAuth) {
      payload.username = authUser.trim();
      payload.password = authPass;
    }
    fetchUrlMutation.mutate(
      { data: payload },
      {
        onSuccess: (data: any) => {
          if (data?.success) {
            setUrlStatus("ok");
            setUrlMsg(data.message || "Data refreshed successfully.");
            queryClient.invalidateQueries();
            toast({ title: "Data source updated", description: "Dashboard refreshed from remote file." });
          } else {
            setUrlStatus("error");
            setUrlMsg(data?.message || "Failed to fetch file.");
          }
        },
        onError: (err: any) => {
          setUrlStatus("error");
          setUrlMsg(err?.message || "Failed to connect to the URL.");
        }
      }
    );
  };

  const summary     = summaryQuery.data;
  const provinceData = provinceQuery.data || [];
  const vehicleData  = vehicleQuery.data || [];
  const etoData      = etoQuery.data || [];
  const lastUpdated  = summary?.lastUpdated || "—";

  const pieData = [
    { name: "CNIC",  value: summary?.cnic || 0 },
    { name: "NTN",   value: summary?.ntn  || 0 },
  ];

  const selectedSource = SOURCE_TYPES.find(s => s.value === sourceType)!;

  const dateStr = now.toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: PK.offWhite, fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── MASTHEAD ──────────────────────────────────────────────── */}
      <header style={{ background: PK.green, color: PK.white, padding: "0 32px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 0", display: "flex", alignItems: "center", gap: 20, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <PakistanEmblem size={52} color={PK.white} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", opacity: 0.75, textTransform: "uppercase" }}>
                Islamic Republic of Pakistan
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 1.2, marginTop: 2 }}>
                Prime Minister's Office
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2, letterSpacing: "0.04em" }}>
                Fuel Subsidy Monitoring Programme
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", lineHeight: 1.5 }}>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{dateStr}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "monospace" }}>{timeStr}</div>
            <div style={{
              display: "inline-block", marginTop: 4,
              background: PK.gold, color: "#000",
              fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
              padding: "2px 10px", borderRadius: 3,
            }}>
              For Official Use Only
            </div>
          </div>
        </div>

        {/* Sub-bar */}
        <div style={{
          background: PK.greenMid, borderTop: `1px solid rgba(255,255,255,0.12)`,
          margin: "0 -32px", padding: "8px 32px",
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, opacity: 0.7, color: PK.white }}>
                Data as of: <strong style={{ opacity: 1 }}>{lastUpdated}</strong>
              </span>
              {!loading && (
                <span style={{
                  background: "rgba(255,255,255,0.15)", color: PK.white,
                  fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
                }}>
                  ● Live
                </span>
              )}
            </div>
            <div className="print:hidden" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ToolBtn onClick={handleRefresh} disabled={loading} title="Refresh data">
                <RefreshCw size={14} className={isSpinning ? "animate-spin" : ""} />
                <span>Refresh</span>
              </ToolBtn>
              <ToolBtn onClick={() => window.print()} title="Print / Export PDF">
                <Printer size={14} />
                <span>Print</span>
              </ToolBtn>
              <ToolBtn onClick={() => setShowDataSource(s => !s)} title="Connect data source" active={showDataSource}>
                <Link2 size={14} />
                <span>Data Source</span>
                <ChevronDown size={12} style={{ transform: showDataSource ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </ToolBtn>
              <label style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                background: "rgba(255,255,255,0.15)", color: PK.white,
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6,
                padding: "5px 12px", fontSize: 12, fontWeight: 600,
                transition: "background 0.15s",
              }}>
                {uploadMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{uploadMutation.isPending ? "Uploading…" : "Upload Excel"}</span>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploadMutation.isPending} />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* ── DATA SOURCE PANEL ──────────────────────────────────────── */}
      {showDataSource && (
        <div style={{
          background: PK.white, borderBottom: `2px solid ${PK.green}`,
          boxShadow: "0 4px 20px rgba(1,65,28,0.12)",
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: PK.green }}>Connect Remote Data Source</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: PK.textMuted }}>
                  Paste a shared link from Google Drive, SharePoint, or OneDrive to automatically sync your Excel data.
                </p>
              </div>
              <button onClick={() => setShowDataSource(false)} style={{ background: "none", border: "none", cursor: "pointer", color: PK.textMuted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Source type selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {SOURCE_TYPES.map(src => (
                <button
                  key={src.value}
                  onClick={() => { setSourceType(src.value); setUrlStatus("idle"); setUrlMsg(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    border: `2px solid ${sourceType === src.value ? PK.green : PK.border}`,
                    background: sourceType === src.value ? PK.greenFaint : PK.white,
                    color: sourceType === src.value ? PK.green : PK.textMuted,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{src.icon}</span>
                  {src.label}
                </button>
              ))}
            </div>

            {/* URL input row */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={e => { setSourceUrl(e.target.value); setUrlStatus("idle"); setUrlMsg(""); }}
                  placeholder={`Paste ${selectedSource.label} URL here…`}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 6, fontSize: 13,
                    border: `1px solid ${urlStatus === "error" ? PK.red : urlStatus === "ok" ? "#22c55e" : PK.border}`,
                    outline: "none", fontFamily: "monospace", color: PK.text,
                    boxSizing: "border-box",
                  }}
                />
                <p style={{ fontSize: 11, color: PK.textMuted, marginTop: 4, marginLeft: 2 }}>{selectedSource.hint}</p>
              </div>
            </div>

            {/* Authentication toggle */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer",
                padding: "8px 14px", borderRadius: 6,
                border: `1px solid ${useAuth ? PK.green : PK.border}`,
                background: useAuth ? PK.greenFaint : PK.white,
                fontSize: 13, fontWeight: 600,
                color: useAuth ? PK.green : PK.textMuted,
                transition: "all 0.15s",
              }}>
                <input
                  type="checkbox"
                  checked={useAuth}
                  onChange={e => { setUseAuth(e.target.checked); setUrlStatus("idle"); setUrlMsg(""); }}
                  style={{ accentColor: PK.green, width: 16, height: 16, cursor: "pointer" }}
                />
                🔐 This file requires login credentials
              </label>
            </div>

            {/* Credentials fields — shown only when useAuth is true */}
            {useAuth && (
              <div style={{
                background: PK.greenFaint, border: `1px solid ${PK.greenBorder}`,
                borderRadius: 8, padding: "18px 20px", marginBottom: 14,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
              }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{
                    margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: PK.green,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    🔒 Authentication Credentials
                  </p>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: PK.textMuted }}>
                    {sourceType === "sharepoint" || sourceType === "onedrive"
                      ? "Enter your Microsoft / Office 365 email and password."
                      : "Enter the username and password required to access this file."}
                  </p>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: PK.green, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {sourceType === "sharepoint" || sourceType === "onedrive" ? "Email / Username" : "Username"}
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={authUser}
                    onChange={e => setAuthUser(e.target.value)}
                    placeholder={sourceType === "sharepoint" || sourceType === "onedrive" ? "user@domain.gov.pk" : "Username"}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 6, fontSize: 13,
                      border: `1px solid ${PK.border}`, outline: "none", color: PK.text,
                      boxSizing: "border-box", background: PK.white,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: PK.green, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={authPass}
                      onChange={e => setAuthPass(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: "100%", padding: "10px 40px 10px 14px", borderRadius: 6, fontSize: 13,
                        border: `1px solid ${PK.border}`, outline: "none", color: PK.text,
                        boxSizing: "border-box", background: PK.white,
                      }}
                    />
                    <button
                      onClick={() => setShowPass(p => !p)}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", padding: 2,
                        color: PK.textMuted, fontSize: 14,
                      }}
                      title={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ margin: 0, fontSize: 11, color: PK.textMuted, lineHeight: 1.5 }}>
                    ⚠️ Credentials are sent securely to the server and are never stored. They are used only for this one-time data fetch.
                  </p>
                </div>
              </div>
            )}

            {/* Fetch button */}
            <button
              onClick={handleFetchFromUrl}
              disabled={urlStatus === "loading" || fetchUrlMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 24px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                background: PK.green, color: PK.white, border: "none",
                cursor: urlStatus === "loading" ? "not-allowed" : "pointer",
                opacity: urlStatus === "loading" ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {urlStatus === "loading" ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {urlStatus === "loading" ? "Fetching data…" : "Pull Data Now"}
            </button>

            {urlMsg && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12,
                padding: "10px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: urlStatus === "ok" ? "#f0fdf4" : "#fef2f2",
                color: urlStatus === "ok" ? "#15803d" : PK.red,
                border: `1px solid ${urlStatus === "ok" ? "#bbf7d0" : "#fecaca"}`,
              }}>
                {urlStatus === "ok" ? <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} /> : <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />}
                <span>{urlMsg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px 48px" }}>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
          <KPICard title="Received from ETO" value={summary?.receivedFromEto} loading={loading}
            subtitle={`CNIC: ${fmt(summary?.cnic)}  /  NTN: ${fmt(summary?.ntn)}`} />
          <KPICard title="Sent to SBP" value={summary?.sentToSbp} loading={loading} />
          <KPICard title="Returned by SBP" value={summary?.returnedBySbp} loading={loading} accent={PK.orange} />
          <KPICard title="Balance with SBP" value={summary?.balanceWithSbp} loading={loading} accent={PK.gold} />
          <KPICard title="Processed by SBP" value={summary?.qtyProcessedBySbp} loading={loading} />
          <KPICard title="Amount Disbursed" value={summary?.amountDisbursedBySbp} loading={loading} accent={PK.gold} />
          <KPICard title="Pending with SBP" value={summary?.qtyPendingWithSbp} loading={loading} accent={PK.orange} />
        </div>

        {/* Charts Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Province Overview */}
          <SectionCard
            title="Province Overview"
            subtitle="Quantities sent to SBP by province"
            action={
              !loading && provinceData.length > 0 ? (
                <CSVLink data={provinceData} filename="province-overview.csv" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: PK.green, textDecoration: "none", padding: "4px 10px", border: `1px solid ${PK.greenBorder}`, borderRadius: 4, background: PK.greenFaint, fontWeight: 600 }}>
                  <Download size={12} /> Export
                </CSVLink>
              ) : null
            }
          >
            {loading ? <Skeleton className="w-full h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220} debounce={0}>
                <BarChart data={provinceData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PK.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: PK.textMuted }} stroke={PK.border} tickFormatter={fmt} />
                  <YAxis dataKey="province" type="category" tick={{ fontSize: 11, fill: PK.text, fontWeight: 600 }} stroke={PK.border} width={82} />
                  <Tooltip content={<GovTooltip />} isAnimationActive={false} cursor={{ fill: PK.greenFaint }} />
                  <Bar dataKey="sentToSbp" name="Sent to SBP" fill={PK.green} radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div style={{ marginTop: 16, overflowX: "auto", maxHeight: 220, overflowY: "auto" }}>
              <GovTable>
                <thead>
                  <tr>
                    <TH>Province</TH>
                    <TH right>Sent</TH>
                    <TH right>Returned</TH>
                    <TH right>Processed</TH>
                    <TH right>Pending</TH>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={5} style={{ padding: "8px 14px" }}><Skeleton className="h-5 w-full" /></td></tr>
                  )) : provinceData.map((row, i) => (
                    <tr key={i} style={{ background: row.province === "Total" ? PK.greenFaint : i % 2 === 0 ? PK.white : "#FAFCFB" }}>
                      <TD bold={row.province === "Total"}>{row.province}</TD>
                      <TD right color={PK.green} bold>{fmt(row.sentToSbp)}</TD>
                      <TD right color={PK.orange}>{fmt(row.returnedBySbp)}</TD>
                      <TD right color="#166534">{fmt(row.qtyProcessedBySbp)}</TD>
                      <TD right color={PK.orange}>{fmt(row.pendingWithSbp)}</TD>
                    </tr>
                  ))}
                </tbody>
              </GovTable>
            </div>
          </SectionCard>

          {/* Vehicle Breakdown */}
          <SectionCard
            title="Vehicle Breakdown"
            subtitle="Sent vs pending by vehicle type"
            action={
              !loading && vehicleData.length > 0 ? (
                <CSVLink data={vehicleData} filename="vehicle-breakdown.csv" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: PK.green, textDecoration: "none", padding: "4px 10px", border: `1px solid ${PK.greenBorder}`, borderRadius: 4, background: PK.greenFaint, fontWeight: 600 }}>
                  <Download size={12} /> Export
                </CSVLink>
              ) : null
            }
          >
            {loading ? <Skeleton className="w-full h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220} debounce={0}>
                <BarChart data={vehicleData.filter(d => d.vehicleType !== "Total")} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PK.border} vertical={false} />
                  <XAxis dataKey="vehicleType" tick={{ fontSize: 11, fill: PK.text }} stroke={PK.border} />
                  <YAxis tick={{ fontSize: 11, fill: PK.textMuted }} stroke={PK.border} tickFormatter={fmt} />
                  <Tooltip content={<GovTooltip />} isAnimationActive={false} cursor={{ fill: PK.greenFaint }} />
                  <Legend content={<GovLegend />} />
                  <Bar dataKey="sentToSbp" name="Sent" fill={PK.green} radius={[3, 3, 0, 0]} isAnimationActive={false} barSize={22} />
                  <Bar dataKey="pendingWithSbp" name="Pending" fill={PK.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div style={{ marginTop: 16, overflowX: "auto", maxHeight: 220, overflowY: "auto" }}>
              <GovTable>
                <thead>
                  <tr>
                    <TH>Vehicle Type</TH>
                    <TH right>Sent</TH>
                    <TH right>Processed</TH>
                    <TH right>Pending</TH>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={4} style={{ padding: "8px 14px" }}><Skeleton className="h-5 w-full" /></td></tr>
                  )) : vehicleData.map((row, i) => (
                    <tr key={i} style={{ background: row.vehicleType === "Total" ? PK.greenFaint : i % 2 === 0 ? PK.white : "#FAFCFB" }}>
                      <TD bold={row.vehicleType === "Total"}>{row.vehicleType}</TD>
                      <TD right color={PK.green} bold>{fmt(row.sentToSbp)}</TD>
                      <TD right color="#166534">{fmt(row.qtyProcessedBySbp)}</TD>
                      <TD right color={PK.orange}>{fmt(row.pendingWithSbp)}</TD>
                    </tr>
                  ))}
                </tbody>
              </GovTable>
            </div>
          </SectionCard>
        </div>

        {/* Bottom Row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>

          {/* ETO Table */}
          <SectionCard
            title="Received from ETO"
            subtitle="Province and vehicle type breakdown"
            action={
              !loading && etoData.length > 0 ? (
                <CSVLink data={etoData} filename="eto-details.csv" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: PK.green, textDecoration: "none", padding: "4px 10px", border: `1px solid ${PK.greenBorder}`, borderRadius: 4, background: PK.greenFaint, fontWeight: 600 }}>
                  <Download size={12} /> Export
                </CSVLink>
              ) : null
            }
          >
            <div style={{ maxHeight: 380, overflowY: "auto", overflowX: "auto" }}>
              <GovTable>
                <thead>
                  <tr>
                    <TH>Province</TH>
                    <TH>Vehicle Type</TH>
                    <TH right>Total</TH>
                    <TH right>CNIC</TH>
                    <TH right>NTN</TH>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={5} style={{ padding: "8px 14px" }}><Skeleton className="h-6 w-full" /></td></tr>
                  )) : etoData.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? PK.white : "#FAFCFB" }}>
                      <TD bold color={PK.green}>{row.province}</TD>
                      <TD>{row.vehicleType}</TD>
                      <TD right bold>{fmt(row.total)}</TD>
                      <TD right color={PK.textMuted} mono>{fmt(row.cnic)}</TD>
                      <TD right color={PK.textMuted} mono>{fmt(row.ntn)}</TD>
                    </tr>
                  ))}
                </tbody>
              </GovTable>
            </div>
          </SectionCard>

          {/* CNIC / NTN Breakdown */}
          <SectionCard title="Identifier Breakdown" subtitle="CNIC vs NTN registered records">
            {loading ? <Skeleton className="w-full h-[260px]" /> : (
              <>
                <ResponsiveContainer width="100%" height={220} debounce={0}>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={60} outerRadius={88}
                      cornerRadius={3} paddingAngle={3}
                      isAnimationActive={false} stroke="none"
                    >
                      <Cell fill={PK.green} />
                      <Cell fill={PK.gold} />
                    </Pie>
                    <Tooltip content={<GovTooltip />} isAnimationActive={false} />
                    <Legend content={<GovLegend />} />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  {[
                    { label: "CNIC", value: summary?.cnic, color: PK.green },
                    { label: "NTN",  value: summary?.ntn,  color: PK.gold },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      textAlign: "center", padding: "14px 10px", borderRadius: 8,
                      background: PK.offWhite, border: `1px solid ${PK.border}`,
                      borderTop: `3px solid ${color}`,
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: PK.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "6px 0 0" }}>{fmt(value)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        background: PK.green, color: PK.white,
        padding: "14px 32px", textAlign: "center",
        fontSize: 11, letterSpacing: "0.06em",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ opacity: 0.7 }}>Islamic Republic of Pakistan — Prime Minister's Office</span>
          <span style={{ fontWeight: 700, opacity: 0.9, letterSpacing: "0.12em" }}>FUEL SUBSIDY MONITORING PROGRAMME</span>
          <span style={{ opacity: 0.7 }}>Confidential — For Official Use Only</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Tool Button ──────────────────────────────────────────────────────── */
function ToolBtn({ children, onClick, disabled, title, active }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; title?: string; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 6,
        fontSize: 12, fontWeight: 600,
        background: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.15)",
        color: "#FFFFFF",
        border: `1px solid ${active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}
