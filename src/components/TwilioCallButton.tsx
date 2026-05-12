"use client";

import { useEffect, useRef, useState } from "react";
import { Call, Device } from "@twilio/voice-sdk";

type CallState = "idle" | "ready" | "connecting" | "in-call" | "ended" | "error";

export default function TwilioCallButton({
  toNumber,
  leadId,
  dealId,
  actor = "Meridian",
  disabled = false,
  disabledReason,
  compact = false,
}: {
  toNumber: string | null | undefined;
  leadId?: string | null;
  dealId?: string | null;
  actor?: string;
  disabled?: boolean;
  disabledReason?: string | null;
  compact?: boolean;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [message, setMessage] = useState("");
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function ensureDevice() {
    if (deviceRef.current) return deviceRef.current;
    setState("connecting");
    setMessage("Preparing phone...");
    const response = await fetch("/api/twilio/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    });
    const data = await response.json();
    if (!response.ok || !data.token) throw new Error(data.error || "Could not prepare Twilio phone.");

    const device = new Device(data.token, {
      logLevel: 1,
    });
    device.on("registered", () => {
      setState("ready");
      setMessage("Phone ready.");
    });
    device.on("error", error => {
      setState("error");
      setMessage(error.message || "Twilio phone error.");
    });
    device.on("incoming", call => {
      callRef.current = call;
      call.accept();
      bindCall(call);
    });
    await device.register();
    deviceRef.current = device;
    return device;
  }

  function bindCall(call: Call) {
    call.on("accept", () => {
      setState("in-call");
      setMessage("Call connected.");
    });
    call.on("disconnect", () => {
      callRef.current = null;
      setState("ended");
      setMessage("Call ended.");
    });
    call.on("cancel", () => {
      callRef.current = null;
      setState("ended");
      setMessage("Call cancelled.");
    });
    call.on("reject", () => {
      callRef.current = null;
      setState("ended");
      setMessage("Call rejected.");
    });
  }

  async function startCall() {
    if (!toNumber || disabled) {
      if (disabledReason) setMessage(disabledReason);
      return;
    }
    try {
      const device = await ensureDevice();
      setState("connecting");
      setMessage("Calling seller...");
      const call = await device.connect({
        params: {
          To: toNumber,
          ...(leadId ? { leadId } : {}),
          ...(dealId ? { dealId } : {}),
        },
      });
      callRef.current = call;
      bindCall(call);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not start call.");
    }
  }

  function endCall() {
    callRef.current?.disconnect();
  }

  const active = state === "connecting" || state === "in-call";
  const label = state === "in-call" ? "Hang Up" : state === "connecting" ? "Calling..." : "Call";
  const title = disabledReason || (state === "in-call" ? "Hang up" : "Call seller");

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        onClick={active ? endCall : startCall}
        disabled={disabled || !toNumber || state === "connecting"}
        style={{
          border: active ? "1px solid var(--brass)" : "1px solid var(--fog)",
          background: active ? "var(--brass)" : "var(--surface)",
          color: active ? "white" : "var(--obsidian)",
          borderRadius: compact ? 999 : 8,
          minWidth: compact ? 38 : undefined,
          minHeight: compact ? 38 : undefined,
          padding: compact ? "8px 10px" : "9px 11px",
          fontWeight: 800,
          fontSize: compact ? 16 : 12,
          cursor: disabled || !toNumber || state === "connecting" ? "not-allowed" : "pointer",
          opacity: disabled || !toNumber ? 0.55 : 1,
        }}
        title={title}
      >
        {compact ? state === "in-call" ? "×" : "☎" : label}
      </button>
      {!compact && (message || disabledReason) && <span style={{ color: state === "error" || disabledReason ? "var(--brass)" : "var(--muted)", fontSize: 11 }}>{disabledReason || message}</span>}
    </div>
  );
}
