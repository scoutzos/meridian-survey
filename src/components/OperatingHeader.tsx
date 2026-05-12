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
        {/* User identity lives in the NavBar (top right) — do not duplicate here */}
        {actions && <div className="operating-header-right"><div className="operating-actions">{actions}</div></div>}
      </div>

      {stats.length > 0 && (
        <div className="operating-stat-grid">
          {stats.map(stat => {
            const clickable = !!stat.onAction;
            return (
              <button
                key={`${stat.label}-${stat.value}`}
                type="button"
                className={`operating-stat operating-stat-${stat.tone ?? "default"}${clickable ? " operating-stat-clickable" : ""}`}
                onClick={stat.onAction}
                disabled={!clickable}
                aria-label={clickable && stat.action ? `${stat.label}: ${stat.value}. ${stat.action}` : `${stat.label}: ${stat.value}`}
              >
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.detail && <small>{stat.detail}</small>}
                {clickable && stat.action && (
                  <span className="operating-stat-cta">{stat.action} →</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

