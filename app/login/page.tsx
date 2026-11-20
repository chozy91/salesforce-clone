"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b5cab] to-[#eef1f6] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-2 flex h-14 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-brand">☁</div>
          <h1 className="text-2xl font-semibold">Sales Cloud Clone</h1>
        </div>
        <form action={action} className="card space-y-4 p-6">
          {mode === "up" && (
            <div>
              <label className="label" htmlFor="full_name">Full name</label>
              <input className="input" id="full_name" name="full_name" required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"} required />
          </div>
          {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
          {state?.message && <p className="rounded bg-green-50 p-2 text-sm text-green-700">{state.message}</p>}
          <button className="btn-primary w-full justify-center py-2" disabled={pending}>
            {pending ? "Please wait…" : mode === "in" ? "Log In" : "Sign Up"}
          </button>
          <button type="button" className="w-full text-center text-sm link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">The first account created becomes the workspace admin.</p>
      </div>
    </main>
  );
}
