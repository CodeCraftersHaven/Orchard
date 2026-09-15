import { useEffect, useState } from "react";
import type { GuildChannel, GuildSettings } from "@orchard/types";
import { Link, useParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { Unauthorized } from "./Unauthorized";
import {
    ApiError,
    avatarUrl,
    getGuildSettings,
    saveGuildSettings,
} from "../lib/api";

const defaultWelcomeBackgroundUrl = "https://i.imgur.com/RCiKhGl.png";

const channelFields: Array<{ key: keyof GuildSettings; label: string; description: string }> = [
    { key: "welcomeC", label: "Welcome messages", description: "Where new member welcome messages are sent." },
    { key: "leaveC", label: "Leave messages", description: "Where member departure messages are sent." },
    { key: "introC", label: "Introductions", description: "Channel referenced by welcome messages." },
    { key: "rolesChannelId", label: "Roles", description: "Channel for role selection and role updates." },
    { key: "announcementsChannelId", label: "Announcements", description: "Primary community announcements channel." },
    { key: "birthdayAnnounceChan", label: "Birthday announcements", description: "Where Orchard announces birthdays." },
    { key: "birthdayLogChannelId", label: "Birthday logs", description: "Where birthday lists and checks are posted." },
    { key: "taskLogsChannelId", label: "Task logs", description: "Where scheduled task activity is recorded." },
    { key: "gamingChannelId", label: "Gaming", description: "Channel used for gaming features." },
    { key: "modC", label: "Moderation", description: "Channel used for moderation activity." },
    { key: "countingChannel", label: "Counting channel", description: "Where members maintain the community count." },
];

const systemGroups = {
    welcome: {
        label: "Welcome",
        description: "Greet new members and customize their welcome experience.",
        fields: ["welcomeC"] as Array<keyof GuildSettings>,
    },
    birthdays: {
        label: "Birthdays",
        description: "Choose where Orchard celebrates subscribed birthdays.",
        fields: ["birthdayAnnounceChan", "birthdayLogChannelId"] as Array<keyof GuildSettings>,
    },
    community: {
        label: "Community channels",
        description: "Connect Orchard to the channels used by community features.",
        fields: ["introC", "rolesChannelId", "announcementsChannelId", "taskLogsChannelId", "gamingChannelId", "modC"] as Array<keyof GuildSettings>,
    },
    counting: {
        label: "Counting",
        description: "Choose the channel and activation state for the counting game.",
        fields: ["countingChannel"] as Array<keyof GuildSettings>,
    },
} as const;

type SystemKey = keyof typeof systemGroups;

function channelOptions(channels: GuildChannel[]) {
    const grouped = new Map<string, GuildChannel[]>();
    const uncategorized: GuildChannel[] = [];
    for (const channel of channels) {
        if (!channel.categoryName) {
            uncategorized.push(channel);
            continue;
        }
        const categoryChannels = grouped.get(channel.categoryName) ?? [];
        categoryChannels.push(channel);
        grouped.set(channel.categoryName, categoryChannels);
    }

    return (
        <>
            <option value="">Not configured</option>
            {uncategorized.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            {[...grouped.entries()].map(([category, categoryChannels]) => (
                <optgroup key={category} label={category}>
                    {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </optgroup>
            ))}
        </>
    );
}

export function GuildManagement() {
    const { guildId, system } = useParams();
    const { user } = useAuth();
    const activeSystem = system && system in systemGroups ? system as SystemKey : undefined;
    const [guildName, setGuildName] = useState("");
    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [settings, setSettings] = useState<Partial<GuildSettings>>({});
    const [botWelcomeMessages, setBotWelcomeMessages] = useState<string[]>([""]);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);
    const [backgroundImageFailed, setBackgroundImageFailed] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        getGuildSettings(guildId)
            .then((response) => {
                setGuildName(response.guild.gName);
                setChannels(response.channels);
                setSettings(response.guild);
                const storedMessages = String(response.guild.botWelcomeMessage ?? "")
                    .split(";")
                    .map((message) => message.trim())
                    .filter(Boolean);
                setBotWelcomeMessages(storedMessages.length ? storedMessages : [""]);
            })
            .catch((err) => {
                if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
                    setUnauthorized(true);
                    return;
                }
                setError(err instanceof ApiError ? err.message : "Failed to load guild settings.");
            })
            .finally(() => setLoading(false));
    }, [guildId]);

    const welcomeBackgroundUrl = settings.welcomeBackgroundUrl?.trim() || defaultWelcomeBackgroundUrl;
    const previewBackgroundUrl = backgroundImageFailed ? defaultWelcomeBackgroundUrl : welcomeBackgroundUrl;
    const previewAvatarUrl = user ? avatarUrl(user) : "https://cdn.discordapp.com/embed/avatars/0.png";
    const avatarPosition = settings.welcomeAvatarPosition ?? "middle";
    const avatarPositionClass = avatarPosition === "left"
        ? "left-[18.5%]"
        : avatarPosition === "right"
            ? "left-[81.5%]"
            : "left-1/2";
    const welcomeChannel = channels.find((channel) => channel.id === settings.welcomeC);
    const introChannel = channels.find((channel) => channel.id === settings.introC);
    const rolesChannel = channels.find((channel) => channel.id === settings.rolesChannelId);
    const welcomePreviewMessage = (botWelcomeMessages[0]?.trim() || `👋 Welcome to ${guildName || "your server"}, {member}`)
        .replaceAll("{guild}", guildName || "your server")
        .replaceAll("{member}", `@${user?.username || "new-member"}`);

    if (unauthorized) return <Unauthorized />;

    const updateSetting = (key: keyof GuildSettings, value: string | boolean) => {
        setSettings((current) => ({ ...current, [key]: value }));
        setNotice(null);
    };

    const save = async () => {
        if (!guildId) return;
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            await saveGuildSettings(guildId, {
                ...settings,
                botWelcomeMessage: botWelcomeMessages.join("; "),
            });
            setNotice("Guild settings saved.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to save guild settings.");
        } finally {
            setSaving(false);
        }
    };

    const updateBotWelcomeMessage = (index: number, value: string) => {
        setBotWelcomeMessages((current) => {
            const next = [...current];
            next[index] = value;
            return next;
        });
        setNotice(null);
    };

    const setMultipleBotWelcomeMessages = (enabled: boolean) => {
        updateSetting("botWelcomeMultiple", enabled);
        if (enabled) {
            setBotWelcomeMessages((current) => current.length > 1 ? current : [...current, ""]);
        } else {
            setBotWelcomeMessages((current) => [current[0] ?? ""]);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1d29,_#0b0d12)]">
            <Navbar />
            <main className="mx-auto max-w-6xl px-6 py-10">
                <Link to="/dashboard" className="text-sm text-slate-400 transition hover:text-white">← Back to servers</Link>

                {loading && <div className="flex items-center gap-3 py-20 text-slate-400"><Spinner /> Loading guild settings…</div>}
                {error && <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

                {!loading && !error && (
                    <>
                        <header className="mt-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
                            <div>
                                <Link to={`/dashboard/guilds/${guildId}`} className="text-xs font-semibold uppercase tracking-[0.25em] text-discord-green hover:text-white">
                                    {activeSystem ? "Back to systems" : "Guild control"}
                                </Link>
                                <h1 className="mt-3 text-3xl font-semibold text-white">{activeSystem ? systemGroups[activeSystem].label : guildName}</h1>
                                <p className="mt-2 text-slate-400">{activeSystem ? systemGroups[activeSystem].description : "Configure Orchard systems and the channels they use."}</p>
                            </div>
                            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-discord-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-discord-green/90 disabled:cursor-wait disabled:opacity-60">
                                {saving ? "Saving…" : "Save changes"}
                            </button>
                        </header>

                        {notice && <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

                        {!activeSystem && <section className="mt-8 grid gap-4 md:grid-cols-3">
                            {(Object.entries(systemGroups) as Array<[SystemKey, (typeof systemGroups)[SystemKey]]>).map(([key, group]) => (
                                <Link key={key} to={`/dashboard/guilds/${guildId}/${key}`} className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-discord-green/60 hover:bg-white/[0.08]">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-discord-green">System</span>
                                    <span className="mt-3 block text-lg font-semibold text-white">{group.label}</span>
                                    <span className="mt-2 block text-sm leading-6 text-slate-400">{group.description}</span>
                                    <span className="mt-5 block text-sm font-semibold text-slate-300 transition group-hover:text-white">Open settings <span aria-hidden="true">→</span></span>
                                </Link>
                            ))}
                        </section>}

                        {activeSystem && <section className="mt-8 grid gap-5 md:grid-cols-2">
                            {channelFields.filter((field) => systemGroups[activeSystem].fields.includes(field.key)).map((field) => (
                                <label key={field.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                    <span className="block font-semibold text-white">{field.label}</span>
                                    <span className="mt-1 block text-sm text-slate-400">{field.description}</span>
                                    <select
                                        value={String(settings[field.key] ?? "")}
                                        onChange={(event) => updateSetting(field.key, event.target.value)}
                                        className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white outline-none transition focus:border-discord-blurple"
                                    >
                                        {channelOptions(channels)}
                                    </select>
                                </label>
                            ))}
                            {activeSystem === "welcome" && <label className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <span className="block font-semibold text-white">Welcome avatar position</span>
                                <span className="mt-1 block text-sm text-slate-400">Choose where the member avatar appears in the welcome image.</span>
                                <select
                                    value={settings.welcomeAvatarPosition ?? "middle"}
                                    onChange={(event) => updateSetting("welcomeAvatarPosition", event.target.value)}
                                    className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white outline-none transition focus:border-discord-blurple"
                                >
                                    <option value="left">Left</option>
                                    <option value="middle">Middle</option>
                                    <option value="right">Right</option>
                                </select>
                            </label>}
                        </section>}

                        {activeSystem === "birthdays" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block font-semibold text-white">Birthday announcements</span>
                                    <span className="mt-1 block text-sm text-slate-400">Allow Orchard to announce subscribed users&apos; birthdays here.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.birthdayEnabled)}
                                    onChange={(event) => updateSetting("birthdayEnabled", event.target.checked)}
                                    className="h-5 w-5 accent-discord-green"
                                />
                            </label>
                        </section>}

                        {activeSystem === "counting" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block font-semibold text-white">Counting system</span>
                                    <span className="mt-1 block text-sm text-slate-400">Allow members to use the configured counting channel.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.countingEnabled)}
                                    onChange={(event) => updateSetting("countingEnabled", event.target.checked)}
                                    className="h-5 w-5 accent-discord-green"
                                />
                            </label>
                        </section>}

                        {activeSystem === "welcome" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <label htmlFor="welcome-background" className="block font-semibold text-white">Welcome background image</label>
                            <span className="mt-1 block text-sm text-slate-400">Use a publicly accessible HTTPS image URL. Leave blank to use Orchard&apos;s default.</span>
                            <input
                                id="welcome-background"
                                type="url"
                                value={settings.welcomeBackgroundUrl ?? ""}
                                onChange={(event) => {
                                    setBackgroundImageFailed(false);
                                    updateSetting("welcomeBackgroundUrl", event.target.value);
                                }}
                                placeholder="https://example.com/welcome-background.png"
                                className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-discord-blurple"
                            />
                            <div className="mt-5 overflow-hidden rounded-xl border border-[#1e1f22] bg-[#313338] text-[#dbdee1] shadow-xl">
                                <div className="flex items-center gap-2 border-b border-[#1e1f22] bg-[#2b2d31] px-4 py-3">
                                    <span className="text-xl text-[#949ba4]">#</span>
                                    <span className="font-semibold text-white">{welcomeChannel?.name || "welcome"}</span>
                                    <span className="ml-auto text-xs text-[#949ba4]">Example message</span>
                                </div>
                                <div className="p-4 sm:p-5">
                                    <div className="flex gap-3">
                                        <img src="https://i.imgur.com/vE1jlXv.png" alt="Pomona bot avatar" className="mt-0.5 h-10 w-10 shrink-0 rounded-full bg-[#5865f2] object-cover" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                <span className="font-semibold text-white">Pomona</span>
                                                <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[0.65rem] font-semibold uppercase text-white">BOT</span>
                                                <span className="text-xs text-[#949ba4]">Today at 12:00 PM</span>
                                            </div>
                                            <p className="mt-1 whitespace-pre-wrap break-words text-[0.95rem] leading-6 text-[#dbdee1]">{welcomePreviewMessage}</p>
                                            <p className="mt-1 text-[0.8rem] leading-5 text-[#b5bac1]">You may now go to <span className="text-[#00a8fc]">#{introChannel?.name || "introductions"}</span> to introduce yourself and <span className="text-[#00a8fc]">#{rolesChannel?.name || "roles"}</span> to get some roles!</p>
                                        </div>
                                    </div>
                                    <div className="relative mt-4 aspect-[1024/500] w-full overflow-hidden rounded-md bg-[#1e1f22]">
                                        <img src={previewBackgroundUrl} alt="Welcome background preview" className="absolute inset-0 h-full w-full object-cover" onError={() => setBackgroundImageFailed(true)} />
                                        <div className="absolute inset-0 bg-black/10" />
                                        <img
                                            src={previewAvatarUrl}
                                            alt="Your avatar in the welcome preview"
                                            className={`absolute top-1/2 h-[34%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white object-cover shadow-lg transition-[left] duration-200 ${avatarPositionClass}`}
                                        />
                                        <div className={`absolute top-[82%] -translate-x-1/2 text-center text-[clamp(0.65rem,2vw,1.1rem)] font-semibold text-[#2d4a22] drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] transition-[left] duration-200 ${avatarPositionClass}`}>
                                            Member #42
                                        </div>
                                    </div>
                                    <button type="button" className="mt-3 rounded-[3px] bg-[#4e5058] px-3 py-1.5 text-sm font-medium text-white">
                                        👋 Wave to say hi!
                                    </button>
                                </div>
                            </div>
                            <span className="mt-2 block text-xs text-slate-500">This Discord-style preview includes the greeting, image, and wave button Pomona sends.</span>
                        </section>}

                        {activeSystem === "welcome" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <span className="mt-3 block font-semibold text-white">Bot welcome message</span>
                            <span className="mt-1 block text-sm text-slate-400">Customize the message sent with the welcome canvas.</span>
                            <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.botWelcomeMultiple)}
                                    onChange={(event) => setMultipleBotWelcomeMessages(event.target.checked)}
                                    className="h-5 w-5 accent-discord-green"
                                />
                                Add multiple messages and choose randomly
                            </label>
                            <div className="mt-4 space-y-3">
                                {botWelcomeMessages.map((message, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        value={message}
                                        onChange={(event) => updateBotWelcomeMessage(index, event.target.value)}
                                        placeholder={["Welcome to our community, {member}!", "We are glad to have you here, {member}.", "Make yourself at home, {member}!", "Say hello to the community, {member}.", "Enjoy your stay, {member}!"][index]}
                                        className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-discord-blurple"
                                    />
                                ))}
                            </div>
                            {Boolean(settings.botWelcomeMultiple) && botWelcomeMessages.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => setBotWelcomeMessages((current) => [...current, ""])}
                                    title="Add another welcome message"
                                    aria-label="Add another welcome message"
                                    className="mt-3 grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-xl text-slate-300 transition hover:border-discord-green hover:text-white"
                                >
                                    +
                                </button>
                            )}
                        </section>}

                    </>
                )}
            </main>
        </div>
    );
}
