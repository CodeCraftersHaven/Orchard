import { useSearchParams, Navigate } from "react-router-dom";
import { discordLoginUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Your login attempt expired or was invalid. Please try again.",
  auth_failed: "We couldn't complete the Discord login. Please try again.",
  access_denied: "You cancelled the Discord authorization.",
};

export function Login() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const error = params.get("error");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1a1d29,_#0b0d12)] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-discord-blurple text-2xl">
          🌳
        </div>
        <h1 className="text-xl font-semibold text-white">Orchard Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with Discord to manage your servers.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </p>
        )}

        <a
          href={discordLoginUrl()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-discord-blurple px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-discord-blurple/20 transition hover:bg-discord-blurple/90"
        >
          <svg viewBox="0 0 127.14 96.36" className="h-5 w-5 fill-current">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
          Continue with Discord
        </a>
      </div>
    </div>
  );
}
