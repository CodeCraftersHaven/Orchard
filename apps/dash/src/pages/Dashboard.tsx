import { useEffect, useState } from "react";
import type { Guild } from "@orchard/types";
import { Navbar } from "../components/Navbar";
import { GuildCard } from "../components/GuildCard";
import { Spinner } from "../components/Spinner";
import { getGuilds } from "../lib/api";
import { ApiError } from "../lib/api";

export function Dashboard() {
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getGuilds()
      .then((data) => {
        if (!cancelled) setGuilds(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load servers.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1d29,_#0b0d12)]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Your servers</h1>
          <p className="mt-1 text-sm text-slate-400">
            All Discord servers connected to your account.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!error && !guilds && (
          <div className="flex items-center gap-3 py-20 text-slate-400">
            <Spinner />
            Loading your servers…
          </div>
        )}

        {!error && guilds && guilds.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-400">
            No Discord servers were found for this account.
          </div>
        )}

        {!error && guilds && guilds.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
