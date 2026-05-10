import { NextRequest, NextResponse } from "next/server";
import { importLandLeadsFromCsv } from "@/lib/land-leads";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    csvText?: string;
    filename?: string;
    sourceSystem?: string;
    campaignSource?: string | null;
    actor?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }

  if (!body.csvText?.trim()) {
    return NextResponse.json({ error: "CSV text is required." }, { status: 400 });
  }
  if (!body.filename?.trim()) {
    return NextResponse.json({ error: "Filename is required." }, { status: 400 });
  }
  if (!body.actor?.trim()) {
    return NextResponse.json({ error: "Importer name is required." }, { status: 400 });
  }

  try {
    const result = await importLandLeadsFromCsv({
      csvText: body.csvText,
      filename: body.filename,
      sourceSystem: body.sourceSystem || "Land List",
      campaignSource: body.campaignSource || null,
      actor: body.actor,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, warning: result.warning ?? null }, { status: 400 });
    }

    return NextResponse.json({
      importedCount: result.leads.length,
      batchId: result.batch?.id ?? null,
      warning: result.warning ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
