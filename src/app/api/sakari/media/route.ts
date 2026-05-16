import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = process.env.SAKARI_MEDIA_BUCKET || "message-media";
const MAX_BYTES = 500 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90) || "image";
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase media upload configuration." }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "MMS images must be JPG, PNG, or GIF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "MMS images must be 500 KB or smaller." }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ext = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName(file.name || `image.${ext}`)}`;
  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error && /bucket|not found/i.test(error.message)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: Array.from(ALLOWED_TYPES),
      fileSizeLimit: MAX_BYTES,
    });
    const retry = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    error = retry.error;
  }
  if (error) return NextResponse.json({ error: `Could not upload MMS image: ${error.message}` }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    media: {
      url: data.publicUrl,
      type: "image",
      contentType: file.type,
      name: file.name || `image.${ext}`,
      filename: file.name || `image.${ext}`,
    },
  });
}
