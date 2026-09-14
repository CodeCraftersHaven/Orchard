import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "@orchard/types";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { getHealth } from "../lib/api";

type Uplink = {
    name: string;
    label: string;
    status: "up" | "down";
    latencyMs: number | null;
    description: string;
    accent: string;
};

function StatusDot({ status }: { status: Uplink["status"] }) {
    return <span className={`h-2.5 w-2.5 rounded-full ${status === "up" ? "bg-emerald-400 shadow-[0_0_14px_#34d399]" : "bg-red-400"}`} />;
}

function Latency({ value }: { value: number | null }) {
    if (value === null) return <span className="text-red-300">Offline</span>;
    return <span>{value} ms</span>;
}

export function Health() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [dashboardLatency, setDashboardLatency] = useState<number | null>(null);
    const [error, setError] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const refresh = useCallback(async () => {
        const startedAt = performance.now();
        setError(false);
        try {
            const result = await getHealth();
            setDashboardLatency(Math.round(performance.now() - startedAt));
            setHealth(result);
            setLastChecked(new Date());
        } catch {
            setDashboardLatency(Math.round(performance.now() - startedAt));
            setHealth(null);
            setError(true);
            setLastChecked(new Date());
        }
    }, []);

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => void refresh(), 30_000);
        return () => window.clearInterval(interval);
    }, [refresh]);

    const uplinks: Uplink[] = [
        {
            name: "Dashboard",
            label: "Browser uplink",
            status: error ? "down" : "up",
            latencyMs: dashboardLatency,
            description: "Your connection to Orchard's control surface.",
            accent: "from-amber-300/20 to-transparent",
        },
        {
            name: "API",
            label: "Request layer",
            status: health?.checks.api.status ?? (error ? "down" : "up"),
            latencyMs: dashboardLatency,
            description: "The service coordinating every dashboard request.",
            accent: "from-discord-blurple/25 to-transparent",
        },
        {
            name: "Bot",
            label: "Discord uplink",
            status: health?.checks.bot.status ?? "down",
            latencyMs: health?.checks.bot.latencyMs ?? null,
            description: "Orchard's live connection to Discord.",
            accent: "from-discord-green/25 to-transparent",
        },
        {
            name: "Database",
            label: "Persistence layer",
            status: health?.checks.database.status ?? "down",
            latencyMs: health?.checks.database.latencyMs ?? null,
            description: "The store for guild configuration and community data.",
            accent: "from-sky-300/20 to-transparent",
        },
    ];

    const operational = uplinks.every((uplink) => uplink.status === "up");

    return (
        <div className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
            <Navbar />
            <main className="mx-auto max-w-6xl px-6 py-12">
                <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-10 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Orchard observatory</p>
                        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">System health</h1>
                        <p className="mt-3 max-w-xl text-slate-400">A live view of the links that keep your communities running.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right text-xs text-slate-500">
                            <div>Auto-refreshes every 30 seconds</div>
                            <div className="mt-1">{lastChecked ? `Checked ${lastChecked.toLocaleTimeString()}` : "Checking now"}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => void refresh()}
                            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <section className="relative mt-10">
                    <div className="pointer-events-none absolute left-[12%] right-[12%] top-[5.5rem] hidden h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent lg:block" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {uplinks.map((uplink) => (
                            <article key={uplink.name} className="relative rounded-2xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur">
                                <div className={`absolute inset-x-0 top-0 h-20 rounded-t-2xl bg-gradient-to-b ${uplink.accent} opacity-70`} />
                                <div className="relative">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{uplink.label}</span>
                                        <StatusDot status={uplink.status} />
                                    </div>
                                    <h2 className="mt-8 text-2xl font-semibold text-white">{uplink.name}</h2>
                                    <p className="mt-2 min-h-12 text-sm leading-5 text-slate-400">{uplink.description}</p>
                                    <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-4">
                                        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Latency</span>
                                        <span className={`text-lg font-semibold ${uplink.status === "up" ? "text-emerald-300" : "text-red-300"}`}>
                                            <Latency value={uplink.latencyMs} />
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <span className={`grid h-11 w-11 place-items-center rounded-full ${operational ? "bg-emerald-400/15" : "bg-red-400/15"}`}>
                            <StatusDot status={operational ? "up" : "down"} />
                        </span>
                        <div>
                            <h2 className="font-semibold text-white">{operational ? "All systems operational" : "Some systems need attention"}</h2>
                            <p className="mt-1 text-sm text-slate-400">{health?.timestamp ? `Last server check ${new Date(health.timestamp).toLocaleTimeString()}` : "Waiting for the first server check"}</p>
                        </div>
                    </div>
                    <Link to="/" className="text-sm font-medium text-amber-300 transition hover:text-amber-200">Return to Orchard →</Link>
                </section>
            </main>
        </div>
    );
}