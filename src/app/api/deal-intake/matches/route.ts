import { NextResponse } from "next/server";
import { fetchDeals } from "@/lib/deals";
import { rankDealIntakeMatches, type DealIntakeInput } from "@/lib/deal-intake";
import { fetchImportedLandLeads } from "@/lib/land-leads";
import { supabase } from "@/lib/supabase";
import type { CrmProperty } from "@/lib/crm";

export const dynamic = "force-dynamic";

function hasIdentifier(input: DealIntakeInput): boolean {
  return Boolean(
    input.query?.trim()
    || input.address?.trim()
    || input.parcel_id?.trim()
    || input.seller_phone?.trim()
    || input.listing_url?.trim(),
  );
}

async function fetchCrmProperties(): Promise<CrmProperty[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("meridian_crm_properties")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error || !data) return [];
  return data as CrmProperty[];
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({})) as DealIntakeInput;
    if (!hasIdentifier(input)) return NextResponse.json({ matches: [] });

    const [leads, crmProperties, deals] = await Promise.all([
      fetchImportedLandLeads(1000),
      fetchCrmProperties(),
      fetchDeals(),
    ]);

    const matches = rankDealIntakeMatches({
      input,
      leads,
      crmProperties,
      deals,
      limit: 8,
    });

    return NextResponse.json({ matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match lookup failed.";
    return NextResponse.json({ error: message, matches: [] }, { status: 500 });
  }
}
