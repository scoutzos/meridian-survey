"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import FloatingSmsWindow from "@/components/FloatingSmsWindow";
import { fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";
import { getCurrentMeridianUser, isVaUser } from "@/lib/identity";
import { fetchImportedLandLeads, updateImportedLandLeadStatus, type ImportedLandLead } from "@/lib/land-leads";

const HIDDEN_ROUTES = ["/", "/apply"];

export default function GlobalSmsDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [leads, setLeads] = useState<ImportedLandLead[]>([]);
  const [events, setEvents] = useState<CommunicationEvent[]>([]);

  const shouldShow = !!user && !HIDDEN_ROUTES.includes(pathname);
  const canSend = isVaUser(user);

  const refresh = async () => {
    const [leadRows, eventRows] = await Promise.all([
      fetchImportedLandLeads(5000),
      fetchCommunicationEvents({ limit: 160 }),
    ]);
    setLeads(leadRows);
    setEvents(eventRows);
  };

  useEffect(() => {
    setUser(getCurrentMeridianUser());
  }, [pathname]);

  useEffect(() => {
    if (!shouldShow) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [shouldShow]);

  if (!shouldShow || !user) return null;

  return (
    <FloatingSmsWindow
      user={user}
      leads={leads}
      events={events}
      canSend={canSend}
      onOpenLead={lead => router.push(`/contacts/${lead.id}?source=imported&from=comms`)}
      onOpenDeal={dealId => router.push(`/opportunity?deal=${dealId}`)}
      onCreateDealBrief={lead => router.push(`/va?tab=packet&lead=${lead.id}`)}
      onCreateDealBriefFromContact={({ phone, name }) => {
        const params = new URLSearchParams({ tab: "packet", seller_phone: phone });
        if (name) params.set("seller_name", name);
        router.push(`/va?${params.toString()}`);
      }}
      onMarkInterested={async lead => {
        await updateImportedLandLeadStatus(lead.id, "interested", lead.deal_id);
        await refresh();
      }}
      onSent={refresh}
    />
  );
}
