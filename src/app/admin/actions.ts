"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIngestionPipeline } from "@/lib/pipeline/ingest";
import { runComputePipeline } from "@/lib/pipeline/compute";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Not authorized");
  return user;
}

export async function triggerPipeline() {
  const user = await assertAdmin();
  const db = createAdminClient();
  await db.from("audit_logs").insert({ user_id: user.id, action: "manual_pipeline_trigger", detail: {} });

  const ingest = await runIngestionPipeline(db);
  const compute = await runComputePipeline(db);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ingest, compute };
}
