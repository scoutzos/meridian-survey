import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// GET /api/responses?member=Name — load all answers for a member
export async function GET(req: NextRequest) {
  const member = req.nextUrl.searchParams.get("member");
  if (!member) return NextResponse.json({ error: "member required" }, { status: 400 });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("meridian_responses")
    .select("question_id, answer")
    .eq("member_name", member);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert array of rows to { questionId: answer } map
  const answers: Record<string, string[] | string> = {};
  for (const row of data || []) {
    try {
      answers[row.question_id] = JSON.parse(row.answer);
    } catch {
      answers[row.question_id] = row.answer;
    }
  }

  return NextResponse.json(answers);
}

// POST /api/responses — save answers for a member
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { member, answers } = body as { member: string; answers: Record<string, string[] | string> };

  if (!member || !answers) {
    return NextResponse.json({ error: "member and answers required" }, { status: 400 });
  }

  const sb = getServiceClient();

  // Upsert each answer as a separate row
  const rows = Object.entries(answers).map(([questionId, answer]) => ({
    member_name: member,
    question_id: questionId,
    answer: JSON.stringify(answer),
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return NextResponse.json({ saved: 0 });
  }

  // Batch upsert — need unique constraint on (member_name, question_id)
  // If no constraint exists, delete + insert
  const { error: delError } = await sb
    .from("meridian_responses")
    .delete()
    .eq("member_name", member);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const { error: insError } = await sb
    .from("meridian_responses")
    .insert(rows);

  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length });
}
