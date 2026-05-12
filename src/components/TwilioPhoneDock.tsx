"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Call, Device } from "@twilio/voice-sdk";

type PhoneState = "offline" | "connecting" | "online" | "ringing" | "in-call" | "error";

function phonePreferenceKey(actor: string): string {
  return `meridian_twilio_phone_online:${actor || "default"}`;
}

export default function TwilioPhoneDock({ actor = "Meridian" }: { actor?: string }) {
  const [state, setState] = useState<PhoneState>("offline");
  const [message, setMessage] = useState("Browser phone is offline.");
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  const bindCall = useCallback((call: Call) => {
    call.on("accept", () => {
      setState("in-call");
      setMessage("Call connected.");
    });
    call.on("disconnect", () => {
      callRef.current = null;
      setState(deviceRef.current ? "online" : "offline");
      setMessage(deviceRef.current ? "Online for inbound calls." : "Browser phone is offline.");
    });
    call.on("cancel", () => {
      callRef.current = null;
      setState(deviceRef.current ? "online" : "offline");
      setMessage("Incoming call ended.");
    });
    call.on("reject", () => {
      callRef.current = null;
      setState(deviceRef.current ? "online" : "offline");
      setMessage("Incoming call rejected.");
    });
  }, []);

  const goOnline = useCallback(async () => {
    if (deviceRef.current || connectingRef.current) return;
    connectingRef.current = true;
    try {
      localStorage.setItem(phonePreferenceKey(actor), "online");
      setState("connecting");
      setMessage("Connecting browser phone...");
      const response = await fetch("/api/twilio/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || "Could not connect browser phone.");

      const device = new Device(data.token, { logLevel: 1 });
      device.on("registered", () => {
        setState("online");
        setMessage("Online for inbound calls.");
      });
      device.on("unregistered", () => {
        setState("offline");
        setMessage("Browser phone is offline.");
      });
      device.on("error", error => {
        setState("error");
        setMessage(error.message || "Twilio phone error.");
      });
      device.on("incoming", call => {
        callRef.current = call;
        setState("ringing");
        setMessage(`Incoming call${call.parameters.From ? ` from ${call.parameters.From}` : ""}.`);
        bindCall(call);
      });
      await device.register();
      deviceRef.current = device;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not connect browser phone.");
    } finally {
      connectingRef.current = false;
    }
  }, [actor, bindCall]);

  useEffect(() => {
    if (localStorage.getItem(phonePreferenceKey(actor)) === "online") void goOnline();
  }, [actor, goOnline]);

  function goOffline() {
    localStorage.setItem(phonePreferenceKey(actor), "offline");
    callRef.current?.disconnect();
    deviceRef.current?.unregister();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
    connectingRef.current = false;
    setState("offline");
    setMessage("Browser phone is offline.");
  }

  function acceptCall() {
    callRef.current?.accept();
  }

  function rejectOrHangUp() {
    if (state === "ringing") callRef.current?.reject();
    else callRef.current?.disconnect();
  }

  const active = state === "online" || state === "ringing" || state === "in-call";
  const urgent = state === "ringing" || state === "error";

  return (
    <section aria-live="polite" style={{
      alignItems: "center",
      background: active ? "rgba(176,137,84,0.09)" : "rgba(255,255,255,0.74)",
      border: active ? "1px solid rgba(176,137,84,0.42)" : "1px solid var(--fog)",
      borderRadius: 8,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "space-between",
      marginBottom: 14,
      padding: "10px 12px",
      boxShadow: "0 10px 26px rgba(20,17,13,0.04)",
    }}>
      <div style={{ alignItems: "center", display: "flex", gap: 10, minWidth: 260 }}>
        <span style={{
          background: urgent ? "var(--brass)" : active ? "#2f8f5b" : "var(--fog)",
          border: "3px solid var(--surface)",
          borderRadius: 999,
          boxShadow: "0 0 0 1px rgba(20,17,13,0.08)",
          display: "inline-block",
          height: 14,
          width: 14,
        }} />
        <div>
          <p style={{ color: "var(--brass)", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>Call desk</p>
          <div style={{ alignItems: "baseline", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            <strong style={{ color: "var(--obsidian)", display: "block", fontSize: 14 }}>
              {state === "offline" ? "Offline" : state === "connecting" ? "Connecting" : state === "ringing" ? "Incoming call" : state === "in-call" ? "On a call" : state === "error" ? "Needs attention" : "Online"}
            </strong>
            <p style={{ color: "var(--muted)", fontSize: 12 }}>{message}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {state === "ringing" && <button type="button" onClick={acceptCall} style={primaryButtonStyle}>Accept</button>}
        {(state === "ringing" || state === "in-call") && <button type="button" onClick={rejectOrHangUp} style={secondaryButtonStyle}>{state === "ringing" ? "Decline" : "Hang Up"}</button>}
        {state === "offline" || state === "error"
          ? <button type="button" onClick={goOnline} style={primaryButtonStyle}>Go Online</button>
          : state !== "ringing" && state !== "in-call" && <button type="button" onClick={goOffline} style={secondaryButtonStyle}>Go Offline</button>}
      </div>
    </section>
  );
}

const primaryButtonStyle = {
  background: "var(--obsidian)",
  border: "1px solid var(--obsidian)",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  padding: "9px 12px",
};

const secondaryButtonStyle = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--obsidian)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  padding: "9px 12px",
};
