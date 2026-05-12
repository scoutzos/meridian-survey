"use client";

import { useEffect, useRef, useState } from "react";
import { Call, Device } from "@twilio/voice-sdk";

type PhoneState = "offline" | "connecting" | "online" | "ringing" | "in-call" | "error";

export default function TwilioPhoneDock({ actor = "Meridian" }: { actor?: string }) {
  const [state, setState] = useState<PhoneState>("offline");
  const [message, setMessage] = useState("Browser phone is offline.");
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function goOnline() {
    if (deviceRef.current) return;
    try {
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
    }
  }

  function bindCall(call: Call) {
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
  }

  function goOffline() {
    callRef.current?.disconnect();
    deviceRef.current?.unregister();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
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

  return (
    <section style={{
      alignItems: "center",
      background: "var(--surface)",
      border: state === "online" || state === "ringing" || state === "in-call" ? "1px solid var(--brass)" : "1px solid var(--fog)",
      borderRadius: 8,
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "space-between",
      marginBottom: 16,
      padding: 12,
    }}>
      <div>
        <p style={{ color: "var(--brass)", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>Call desk</p>
        <strong style={{ color: "var(--obsidian)", display: "block", fontSize: 14, marginTop: 4 }}>
          {state === "offline" ? "Offline" : state === "connecting" ? "Connecting" : state === "ringing" ? "Incoming call" : state === "in-call" ? "On a call" : state === "error" ? "Needs attention" : "Online"}
        </strong>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{message}</p>
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
