import { useEffect, useState } from "react";
import type { OrchardStats } from "@orchard/types";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { getOrchardStats } from "../lib/api";

const featureCards = [
    {
        title: "Server health",
        description: "Monitor your community, keep roles tidy, and make sure new members feel welcome.",
        accent: "from-discord-blurple/25 to-transparent",
    },
    {
        title: "Smart automations",
        description: "Celebrate birthdays, greet new arrivals, and automate repetitive moderation tasks.",
        accent: "from-discord-green/25 to-transparent",
    },
    {
        title: "Clear insights",
        description: "See what is happening across your Discord community without digging through logs.",
        accent: "from-sky-400/25 to-transparent",
    },
];

export function Home() {
    const [statsData, setStatsData] = useState<OrchardStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        getOrchardStats().then((loadedStats) => {
            if (!cancelled) setStatsData(loadedStats);
        }).catch(() => {
            if (!cancelled) setStatsData(null);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const stats = [
        {
            label: "Watched Servers",
            value: statsData ? statsData.watchedServers.toLocaleString() : "—",
            tone: "text-discord-green",
        },
        {
            label: "Authorized Users",
            value: statsData ? statsData.authorizedUsers.toLocaleString() : "—",
            tone: "text-discord-blurple",
        },
        {
            label: "Watched Members",
            value: statsData ? statsData.watchedMembers.toLocaleString() : "—",
            tone: "text-sky-300",
        },
    ];

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1d29,_#0b0d12)] text-slate-100">
            <Navbar />

            <main className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-20">
                <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <span className="inline-flex items-center rounded-full border border-discord-blurple/30 bg-discord-blurple/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-discord-blurple">
                            Community automation
                        </span>

                        <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                            Grow a warmer, smarter Discord community.
                        </h1>

                        <p className="mt-5 max-w-xl text-lg text-slate-300">
                            Orchard helps server owners automate welcoming rituals, birthday moments, and day-to-day
                            tasks so your community feels active and cared for.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-4">
                            <Link
                                to="/login"
                                className="rounded-xl bg-discord-blurple px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-discord-blurple/20 transition hover:bg-discord-blurple/90"
                            >
                                Get started
                            </Link>
                            <Link
                                to="/dashboard"
                                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                            >
                                View dashboard
                            </Link>
                            <Link
                                to="/health"
                                className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/10"
                            >
                                System health
                            </Link>
                        </div>

                        <div className="mt-10 flex flex-wrap items-center gap-8 text-sm text-slate-400">
                            <div>
                                <div className="text-2xl font-bold text-white">24/7</div>
                                <div>Automation</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">3x</div>
                                <div>Faster setup</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">100%</div>
                                <div>Discord-first</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30 backdrop-blur">
                            <div className="rounded-2xl border border-white/10 bg-[#121722] p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Orchard overview</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-white">Guild pulse</h2>
                                    </div>
                                    <div className="rounded-full bg-discord-green/15 px-2.5 py-1 text-xs font-medium text-discord-green">
                                        {statsData ? "Live" : "Loading"}
                                    </div>
                                </div>

                                <div className="mt-6 space-y-4">
                                    {stats.map((stat) => (
                                        <div
                                            key={stat.label}
                                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                                        >
                                            <span className="text-sm text-slate-300">{stat.label}</span>
                                            <span className={`text-lg font-semibold ${stat.tone}`}>{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-20">
                    <div className="mb-8 max-w-2xl">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Why Orchard</p>
                        <h2 className="mt-3 text-3xl font-bold text-white">Built for communities that want to feel alive.</h2>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                        {featureCards.map((feature) => (
                            <article
                                key={feature.title}
                                className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10"
                            >
                                <div className={`mb-4 h-12 rounded-xl bg-gradient-to-r ${feature.accent}`} />
                                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                                <p className="mt-3 text-sm leading-6 text-slate-300">{feature.description}</p>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
