import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";

const terms = [
    { number: "01", title: "Using Orchard", body: "You may use Orchard only when you have the authority to connect and configure it for a Discord server. You are responsible for the settings you choose, the permissions you grant, and the messages or automations your server produces." },
    { number: "02", title: "Your Discord community", body: "Orchard is a tool for server administration, not a replacement for your moderation judgment. Follow Discord's rules, respect your members, and make sure your server's own policies cover the features you enable." },
    { number: "03", title: "Acceptable behavior", body: "Do not use Orchard to spam, harass, impersonate, evade moderation, collect information without a legitimate reason, or interfere with Discord, Orchard, or another user's access. We may restrict access when misuse threatens the service or its users." },
    { number: "04", title: "Content and permissions", body: "You keep responsibility for content you configure or cause Orchard to publish. You grant Orchard the permissions needed to perform enabled features and represent that you have the right to use any content, images, names, or links you provide." },
    { number: "05", title: "Availability and changes", body: "Orchard is provided as an evolving service. Features may change, pause, or be discontinued, including when Discord changes its APIs or permissions. We will take reasonable care, but cannot promise uninterrupted availability or that every configuration will work in every server." },
    { number: "06", title: "Ending access", body: "You can stop using Orchard by signing out or removing the bot from your server. We may suspend or end access for abuse, security concerns, legal requirements, or material violations of these terms. Sections that need to survive termination will continue to do so." },
];

export function TermsOfService() {
    return (
        <div className="min-h-screen bg-[#0b0d12] text-slate-100">
            <Navbar />
            <main className="relative overflow-hidden">
                <div className="pointer-events-none absolute right-0 top-0 h-[38rem] w-[42rem] bg-[radial-gradient(circle_at_70%_8%,rgba(88,101,242,0.2),transparent_42%),radial-gradient(circle_at_25%_30%,rgba(245,158,11,0.1),transparent_32%)]" />
                <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
                    <div className="max-w-3xl">
                        <Link to="/" className="text-sm font-semibold text-discord-blurple hover:text-indigo-300">← Back to Orchard</Link>
                        <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-8">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-discord-blurple">Legal / 02</p>
                                <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl">Terms of service.</h1>
                            </div>
                            <p className="max-w-[12rem] text-right text-xs leading-5 text-slate-500">Last updated<br />September 21, 2026</p>
                        </div>
                        <p className="mt-8 max-w-2xl text-xl leading-8 text-slate-300">The ground rules for using Orchard to run thoughtful, well-moderated Discord communities.</p>
                    </div>

                    <div className="mt-14 grid gap-12 lg:grid-cols-[0.62fr_1.38fr]">
                        <aside className="lg:sticky lg:top-28 lg:self-start">
                            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-5"><p className="text-sm font-semibold text-amber-100">Read before connecting</p><p className="mt-2 text-sm leading-6 text-amber-100/65">By connecting Orchard or using the dashboard, you agree to these terms and to use the service responsibly.</p></div>
                            <div className="mt-8 space-y-3 text-sm text-slate-500">{terms.map((term) => <div key={term.number} className="flex gap-3"><span className="font-mono text-amber-300">{term.number}</span><span>{term.title}</span></div>)}</div>
                        </aside>

                        <article className="space-y-5">
                            {terms.map((term) => <section key={term.number} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/20 hover:bg-white/[0.055] sm:p-8"><div className="flex gap-5"><span className="font-mono text-sm text-amber-300/80">{term.number}</span><div><h2 className="text-2xl font-bold text-white">{term.title}</h2><p className="mt-4 max-w-2xl leading-7 text-slate-300">{term.body}</p></div></div></section>)}
                            <section className="rounded-3xl border border-white/10 bg-[#121722] p-6 sm:p-8"><h2 className="text-2xl font-bold text-white">A few important details</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold text-slate-200">No warranty</h3><p className="mt-2 text-sm leading-6 text-slate-500">To the extent permitted by law, Orchard is provided as-is and as-available.</p></div><div><h3 className="font-semibold text-slate-200">Limited liability</h3><p className="mt-2 text-sm leading-6 text-slate-500">Orchard is not responsible for indirect losses arising from use or inability to use the service.</p></div><div><h3 className="font-semibold text-slate-200">Discord is separate</h3><p className="mt-2 text-sm leading-6 text-slate-500">Orchard is not Discord and is not endorsed by Discord unless expressly stated.</p></div><div><h3 className="font-semibold text-slate-200">Questions</h3><p className="mt-2 text-sm leading-6 text-slate-500">Reach the Orchard operator through the project&apos;s configured support channel.</p></div></div></section>
                        </article>
                    </div>
                </div>
            </main>
        </div>
    );
}
