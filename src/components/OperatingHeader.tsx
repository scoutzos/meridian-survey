"use client";

import type { ReactNode } from "react";

export type OperatingHeaderStat = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "hot" | "good" | "muted";
  action?: string;
  onAction?: () => void;
};

type OperatingHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  user?: string | null;
  mode?: "member" | "va" | "crm";
  actions?: ReactNode;
  stats?: OperatingHeaderStat[];
};

export default function OperatingHeader({
  eyebrow,
  title,
  subtitle,
  user,
  mode = "member",
  actions,
  stats = [],
}: OperatingHeaderProps) {
  return (
    <section className={`operating-header operating-header-${mode}`}>
      <div className="operating-header-main">
        <div>
          <p className="operating-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="operating-subtitle">{subtitle}</p>
        </div>
        <div className="operating-header-right">
          {user && (
            <div className="operating-user-chip">
              <span>{initials(user)}</span>
              <strong>{user}</strong>
            </div>
          )}
          {actions && <div className="operating-actions">{actions}</div>}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="operating-stat-grid">
          {stats.map(stat => (
            <button
              key={`${stat.label}-${stat.value}`}
              type="button"
              className={`operating-stat operating-stat-${stat.tone ?? "default"}`}
              onClick={stat.onAction}
              disabled={!stat.onAction}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              {stat.detail && <small>{stat.detail}</small>}
              {stat.action && <em>{stat.action}</em>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
