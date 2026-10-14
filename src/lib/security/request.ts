import "server-only";
import { headers } from "next/headers";

export type ClientInfo = { ip: string; ipMasked: string; userAgent: string };

/** Client address and agent, as seen through Vercel's proxy headers. */
export async function getClientInfo(): Promise<ClientInfo> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] || h.get("x-real-ip") || "unknown").trim().slice(0, 64);
  const userAgent = (h.get("user-agent") || "").slice(0, 200);
  return { ip, ipMasked: maskIp(ip), userAgent };
}

/** Keeps enough to recognise "my network" without storing a full address. */
export function maskIp(ip: string): string {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") return "this machine";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [a, b] = ip.split(".");
    return `${a}.${b}.x.x`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 3).join(":")}:…`;
  }
  return "unknown";
}

/** Browser and OS names from a user agent string, for the UI to phrase in its own language. */
export function parseAgent(ua: string | null | undefined): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return { browser, os };
}

/** Short human label for a user agent string. */
export function describeAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
