import { isSupabaseConfigured } from "@/lib/supabase/config";

export function BackendNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="border-b border-[#e0b93d] bg-[#3d3a1d] px-4 py-2 text-center text-xs text-[#e0b93d]">
      Backend not configured — this is a local UI preview only. Every page will show empty/no-data
      states until Supabase env vars are set (see README.md &ldquo;One-time setup&rdquo;).
    </div>
  );
}
