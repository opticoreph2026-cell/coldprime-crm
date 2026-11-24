// Environment-driven feature flags. Absent or malformed values mean OFF (fail closed),
// so shipping the code never silently enables a capability in production.

/** Legacy bulk sender on /emails. Off by default; the platform moves to per-record sends. */
export function bulkSendEnabled(): boolean {
  return process.env.BULK_SEND_ENABLED === "true";
}
