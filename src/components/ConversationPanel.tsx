"use client";

import type { CSSProperties, ReactNode } from "react";
import type { CommunicationEvent } from "@/lib/communications";

export type ConversationActivity = {
  id: string;
  title: string;
  date: string;
  body: string;
  meta?: string | null;
};

type ConversationPanelProps = {
  title?: string;
  eyebrow?: string;
  subject?: string | null;
  communications: CommunicationEvent[];
  activities?: ConversationActivity[];
  emptyText?: string;
  maxHeight?: number;
  compact?: boolean;
  composer?: ReactNode;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function normalizedStatus(event: CommunicationEvent): string {
  return (event.status || event.raw_payload?.CallStatus || event.raw_payload?.DialCallStatus || event.provider_event_type || "")
    .toString()
    .toLowerCase();
}

function isVoicemailRecording(event: CommunicationEvent): boolean {
  return event.provider_event_type === "call-recording" && /^voicemail\b/i.test(event.body || "");
}

function voiceLabel(event: CommunicationEvent): string {
  const status = normalizedStatus(event);
  if (event.provider_event_type === "call-recording") return isVoicemailRecording(event) ? "Voicemail" : "Recording";
  if (event.direction === "inbound" && ["no-answer", "busy", "failed", "canceled", "cancelled", "missed"].includes(status)) return "Missed call";
  if (event.direction === "inbound") return "Inbound call";
  if (event.direction === "outbound") return "Outbound call";
  if (status === "no-answer") return "No answer";
  if (status === "busy") return "Busy call";
  if (status === "failed") return "Failed call";
  return "Call update";
}

function voiceBody(event: CommunicationEvent): string {
  const status = normalizedStatus(event);
  const duration = event.raw_payload?.CallDuration || event.raw_payload?.DialCallDuration;
  const seconds = typeof duration === "string" && duration.trim() ? duration.trim() : event.body?.match(/·\s*(\d+)s/)?.[1];
  const suffix = seconds ? ` · ${seconds}s` : "";
  if (event.provider_event_type === "call-recording") return event.body || `${isVoicemailRecording(event) ? "Voicemail" : "Recording"} ${event.status || "saved"}`;
  if (event.direction === "inbound" && ["no-answer", "busy", "failed", "canceled", "cancelled", "missed"].includes(status)) return `Missed inbound call${suffix}`;
  if (event.direction === "inbound") return `Inbound call ${event.status || "updated"}${suffix}`;
  if (event.direction === "outbound") return `Outbound call ${event.status || "updated"}${suffix}`;
  return event.body || event.status || "Call update";
}

function labelForEvent(event: CommunicationEvent): string {
  if (event.channel === "voice") {
    return voiceLabel(event);
  }
  if (event.direction === "inbound") return "Seller SMS";
  if (event.direction === "outbound") return "Meridian SMS";
  if (event.direction === "status") return "SMS status";
  return "SMS update";
}

function recordingUrl(event: CommunicationEvent): string | null {
  const recording = event.media.find(item =>
    item && typeof item === "object" && (item as Record<string, unknown>).type === "recording"
  ) as Record<string, unknown> | undefined;
  const mp3Url = typeof recording?.mp3Url === "string" ? recording.mp3Url : null;
  const url = typeof recording?.url === "string" ? recording.url : null;
  const rawUrl = mp3Url || url;
  if (!rawUrl) return null;
  const recordingSid = typeof recording?.recordingSid === "string" ? recording.recordingSid : rawUrl.match(/\/Recordings\/(RE[a-zA-Z0-9]+)/)?.[1];
  if (recordingSid && (recording?.provider === "twilio" || rawUrl.includes("api.twilio.com"))) {
    return `/api/twilio/voice/recording-audio?sid=${encodeURIComponent(recordingSid)}`;
  }
  return rawUrl;
}

function displayMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "api.sakari.io") return `/api/sakari/media-proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
  return url;
}

function imageMedia(event: CommunicationEvent): Array<{ url: string; label: string }> {
  return event.media
    .map(item => item && typeof item === "object" ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => !!item)
    .filter(item => item.type !== "recording")
    .map(item => {
      const url = [item.url, item.mediaUrl, item.media_url, item.href]
        .find(value => typeof value === "string" && value) as string | undefined;
      const contentType = String(item.contentType || item.content_type || item.mimeType || item.type || "");
      const label = String(item.name || item.filename || "Photo");
      if (!url || (contentType && !contentType.includes("image") && !/\.(jpe?g|png|gif)(\?|$)/i.test(url))) return null;
      return { url: displayMediaUrl(url), label };
    })
    .filter((item): item is { url: string; label: string } => !!item);
}

export default function ConversationPanel({
  title = "Conversation",
  eyebrow = "Communication",
  subject,
  communications,
  activities = [],
  emptyText = "No communication yet.",
  maxHeight = 420,
  compact = false,
  composer,
}: ConversationPanelProps) {
  const items = [
    ...communications.map(event => {
      const images = imageMedia(event);
      return {
        id: `comm-${event.id}`,
        kind: event.direction === "inbound" ? "inbound" as const : event.direction === "outbound" ? "outbound" as const : "system" as const,
        title: labelForEvent(event),
        date: event.provider_created_at || event.created_at,
        body: event.channel === "voice" ? voiceBody(event) : event.body || (images.length ? "Photo received" : event.status || event.provider_event_type),
        meta: event.status || event.provider_event_type,
        recording: recordingUrl(event),
        images,
      };
    }),
    ...activities.map(activity => ({
      id: `activity-${activity.id}`,
      kind: "activity" as const,
      title: activity.title,
      date: activity.date,
      body: activity.body,
      meta: activity.meta || undefined,
      recording: null,
      images: [],
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section style={panel}>
      <div style={header}>
        <div>
          <p style={eyebrowStyle}>{eyebrow}</p>
          <h3 style={{ ...titleStyle, fontSize: compact ? 20 : 24 }}>{title}</h3>
          {subject && <p style={subjectStyle}>{subject}</p>}
        </div>
        <span style={pill}>{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ ...thread, maxHeight }}>
        {items.map(item => (
          <div
            key={item.id}
            style={{
              ...bubble,
              ...(item.kind === "inbound" ? inboundBubble : item.kind === "outbound" ? outboundBubble : activityBubble),
              marginLeft: item.kind === "outbound" ? 28 : 0,
              marginRight: item.kind === "inbound" ? 28 : 0,
            }}
          >
            <div style={bubbleHeader}>
              <strong style={bubbleTitle}>{item.title}</strong>
              <span style={miniLabel}>{formatDate(item.date)}</span>
            </div>
            <p style={bubbleBody}>{item.body}</p>
            {item.recording && (
              <div style={recordingShell}>
                <audio controls preload="none" src={item.recording} style={recordingPlayer} />
              </div>
            )}
            {item.images.length > 0 && (
              <div style={imageGrid}>
                {item.images.map(image => (
                  <a key={image.url} href={image.url} target="_blank" rel="noreferrer" style={imageLink}>
                    <img src={image.url} alt={image.label} style={imagePreview} />
                  </a>
                ))}
              </div>
            )}
            {item.meta && <p style={bubbleMeta}>{item.meta}</p>}
          </div>
        ))}
        {items.length === 0 && <p style={emptyStyle}>{emptyText}</p>}
      </div>

      {composer && <div style={composerWrap}>{composer}</div>}
    </section>
  );
}

const panel: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
};

const header: CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "space-between",
  marginBottom: 10,
};

const eyebrowStyle: CSSProperties = {
  color: "var(--brass)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.16em",
  marginBottom: 5,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  color: "var(--obsidian)",
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  lineHeight: 1.08,
};

const subjectStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.35,
  marginTop: 4,
};

const pill: CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 800,
  padding: "5px 9px",
};

const thread: CSSProperties = {
  display: "grid",
  gap: 8,
  overflow: "auto",
};

const bubble: CSSProperties = {
  borderRadius: 8,
  padding: 10,
};

const inboundBubble: CSSProperties = {
  background: "rgba(176,137,84,0.10)",
  border: "1px solid var(--brass)",
};

const outboundBubble: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
};

const activityBubble: CSSProperties = {
  background: "rgba(255,255,255,0.58)",
  border: "1px solid var(--fog)",
};

const bubbleHeader: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
  marginBottom: 5,
};

const bubbleTitle: CSSProperties = {
  color: "var(--obsidian)",
  fontSize: 12,
};

const miniLabel: CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const bubbleBody: CSSProperties = {
  color: "var(--ink)",
  fontSize: 13,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};

const bubbleMeta: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  marginTop: 6,
};

const recordingPlayer: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  width: "100%",
};

const recordingShell: CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  marginTop: 8,
  padding: 7,
};

const imageGrid: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  marginTop: 8,
};

const imageLink: CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  display: "block",
  overflow: "hidden",
};

const imagePreview: CSSProperties = {
  aspectRatio: "4 / 3",
  display: "block",
  objectFit: "cover",
  width: "100%",
};

const emptyStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.45,
};

const composerWrap: CSSProperties = {
  borderTop: "1px solid var(--fog)",
  marginTop: 12,
  paddingTop: 12,
};
