import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export function Unauthorized() {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#24151b,_#0b0d12)] text-slate-100">
            <Navbar />
            <main className="mx-auto flex max-w-3xl px-6 py-24">
                <section className="w-full rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-8 text-center shadow-2xl shadow-black/20 sm:p-12">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-red-300/30 bg-red-400/15 text-2xl text-red-200">
                        !
                    </div>
                    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-red-300">Access denied</p>
                    <h1 className="mt-3 text-3xl font-semibold text-white">You cannot manage this guild</h1>
                    <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-400">
                        This server is not available to your account, you do not have Administrator permissions, or Orchard is not installed there.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link to="/dashboard" className="rounded-lg bg-discord-blurple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-discord-blurple/90">
                            Return to servers
                        </Link>
                        <Link to="/" className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10">
                            Go home
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}