import Link from "next/link";
import { signUp } from "@/app/login/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const { error, check_email } = await searchParams;

  if (check_email) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-text-dim">
          We sent a confirmation link to finish creating your account. Your 90-day free trial starts once
          you confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-semibold">Start your free trial</h1>
        <p className="mt-1 text-sm text-text-dim">Free for 90 days. No card required.</p>
      </div>

      {error && (
        <div className="rounded border border-[#e05a4d] bg-[#2a1414] px-3 py-2 text-sm text-[#e05a4d]">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={signUp} className="flex flex-col gap-4">
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
            minLength={8}
            required
            className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded bg-accent px-4 py-2 text-sm font-medium text-[#061018] hover:opacity-90"
        >
          Create account
        </button>
      </form>

      <p className="text-sm text-text-dim">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
