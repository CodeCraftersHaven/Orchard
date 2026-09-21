import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";

const sections = [
    ["01", "What we collect"],
    ["02", "How we use it"],
    ["03", "Discord data"],
    ["04", "Your choices"],
];

export function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#0b0d12] text-slate-100">
            <Navbar />
            <main className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_15%_15%,rgba(35,165,90,0.18),transparent_34%),radial-gradient(circle_at_85%_0%,rgba(88,101,242,0.2),transparent_30%)]" />
                <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
                    <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
                        <aside className="lg:sticky lg:top-28 lg:self-start">
                            <Link to="/" className="text-sm font-semibold text-discord-green hover:text-emerald-300">← Back to Orchard</Link>
                            <p className="mt-12 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Legal / 01</p>
                            <h1 className="mt-4 max-w-md text-5xl font-black tracking-tight text-white sm:text-6xl">Privacy, plainly.</h1>
                            <p className="mt-6 max-w-sm text-base leading-7 text-slate-400">A clear account of what Orchard needs to operate, what it never needs, and the choices that remain yours.</p>
                            <div className="mt-10 border-l border-white/10 pl-4">
                                {sections.map(([number, label]) => <div key={number} className="mb-3 flex gap-3 text-sm"><span className="font-mono text-discord-green">{number}</span><span className="text-slate-400">{label}</span></div>)}
                            </div>
                            <p className="mt-12 text-xs leading-5 text-slate-600">Last updated: September 21, 2026</p>
                        </aside>

                        <article className="min-w-0">
                            <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.06] p-6 sm:p-8">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">The short version</p>
                                <p className="mt-4 text-xl leading-8 text-emerald-50">Orchard uses the minimum information needed to authenticate administrators, manage connected Discord servers, and run the community features you enable. We do not sell personal information.</p>
                            </div>

                            <div className="mt-10 space-y-12">
                                <section id="what-we-collect">
                                    <span className="font-mono text-sm text-discord-green">01 /</span>
                                    <h2 className="mt-3 text-3xl font-bold text-white">What we collect</h2>
                                    <p className="mt-4 leading-7 text-slate-300">When you sign in with Discord, Orchard receives the account details Discord makes available for authentication, such as your Discord user ID, username, display name, avatar, and OAuth tokens required to keep your session active.</p>
                                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h3 className="font-semibold text-white">Account basics</h3><p className="mt-2 text-sm leading-6 text-slate-400">Identity and session information used to recognize you and keep you signed in.</p></div>
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h3 className="font-semibold text-white">Guild configuration</h3><p className="mt-2 text-sm leading-6 text-slate-400">Settings you or another administrator choose for a connected server.</p></div>
                                    </div>
                                </section>

                                <section id="how-we-use-it">
                                    <span className="font-mono text-sm text-discord-green">02 /</span>
                                    <h2 className="mt-3 text-3xl font-bold text-white">How we use it</h2>
                                    <ul className="mt-5 space-y-4 text-slate-300">
                                        <li className="flex gap-4"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-discord-green" /><span>Authenticate you and protect dashboard access.</span></li>
                                        <li className="flex gap-4"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-discord-green" /><span>Display the servers where you have permission to manage Orchard.</span></li>
                                        <li className="flex gap-4"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-discord-green" /><span>Store and apply the automations, channels, roles, and content settings you configure.</span></li>
                                        <li className="flex gap-4"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-discord-green" /><span>Monitor reliability, prevent abuse, and troubleshoot failures.</span></li>
                                    </ul>
                                </section>

                                <section id="discord-data">
                                    <span className="font-mono text-sm text-discord-green">03 /</span>
                                    <h2 className="mt-3 text-3xl font-bold text-white">Discord data and third parties</h2>
                                    <p className="mt-4 leading-7 text-slate-300">Orchard is built on Discord. The bot may process messages, reactions, member events, channel identifiers, role identifiers, and other event data when a server administrator enables a feature that needs it. Processing is limited to delivering that feature.</p>
                                    <p className="mt-4 leading-7 text-slate-300">Discord independently processes data under its own terms and privacy policy. Orchard may also rely on infrastructure providers for hosting, databases, authentication, and error monitoring. Those providers process data only to provide services to Orchard.</p>
                                    <p className="mt-4 leading-7 text-slate-300">We, here at Orchard, take your privacy seriously and only process the data necessary to provide and improve our services. Our database is secured to unreadable files, even by us stored offsite and encrypted to prevent unauthorized access.</p>
                                </section>

                                <section id="your-choices">
                                    <span className="font-mono text-sm text-discord-green">04 /</span>
                                    <h2 className="mt-3 text-3xl font-bold text-white">Your choices</h2>
                                    <p className="mt-4 leading-7 text-slate-300">You can sign out at any time, remove Orchard from a server, disable individual systems, or ask the Orchard operator to review or delete information associated with your account. Removing the bot may stop feature processing but does not automatically change records retained for security or legal obligations.</p>
                                    <div className="mt-6 rounded-2xl border border-sky-300/15 bg-sky-300/[0.06] p-6"><h3 className="font-semibold text-sky-100">Questions or requests</h3><p className="mt-2 text-sm leading-6 text-sky-100/70">Contact the Orchard operator through the project&apos;s configured support channel. Include your Discord user ID and the server involved so a request can be handled accurately. Ticket system coming soon!</p></div>
                                </section>
                            </div>
                        </article>
                    </div>
                </div>
            </main>
        </div>
    );
}
