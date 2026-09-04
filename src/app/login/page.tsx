import Link from "next/link";
import { signIn } from "./actions";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-text-dim">Access your GFEW research workspace.</p>
      </div>

      {error && (
        <div className="rounded border border-[#e05a4d] bg-[#2a1414] px-3 py-2 text-sm text-[#e05a4d]">
          {decodeURIComponent(error)}
        </div>
      )}

      <GoogleButton next={next} />

      <div className="flex items-center gap-3 text-xs text-text-dim">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded bg-accent px-4 py-2 text-sm font-medium text-[#061018] hover:opacity-90"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-text-dim">
        No account yet?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Start your free trial
        </Link>
      </p>
    </div>
  );
}
