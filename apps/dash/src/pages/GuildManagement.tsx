import { useEffect, useState, type ReactNode } from "react";
import type { EconomyItemDefinition, GuildChannel, GuildRole, GuildSettings, ReactionRolePanel, WelcomeMode } from "@orchard/types";
import { Link, useParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Spinner } from "../components/Spinner";
import { GuildNavigationMenu } from "../components/GuildNavigationMenu";
import { useAuth } from "../context/AuthContext";
import { Unauthorized } from "./Unauthorized";
import {
    ApiError,
    avatarUrl,
    getGuildSettings,
    getReactionRoles,
    createReactionRolePanel,
    deleteReactionRolePanel,
    createVerificationPanel,
    getSetupNotes,
    saveSetupNotes,
    saveGuildSettings,
    disableGuildSystem,
    getEconomyItems,
    createEconomyItem,
    updateEconomyItem,
    deleteEconomyItem,
} from "../lib/api";

const defaultWelcomeBackgroundUrl = "https://i.imgur.com/RCiKhGl.png";

const channelFields: Array<{ key: keyof GuildSettings; label: string; description: string }> = [
    { key: "welcomeC", label: "Welcome messages", description: "Where new member welcome messages are sent." },
    { key: "leaveC", label: "Leave messages", description: "Where member departure messages are sent. Set to Not configured to disable." },
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
        fields: ["introC", "announcementsChannelId", "taskLogsChannelId", "gamingChannelId", "modC", "leaveC"] as Array<keyof GuildSettings>,
    },
    counting: {
        label: "Counting",
        description: "Choose the channel and activation state for the counting game.",
        fields: ["countingChannel"] as Array<keyof GuildSettings>,
    },
    serverStats: {
        label: "Server stats",
        description: "Configure visible voice-channel counters for all members, users, and bots.",
        fields: [] as Array<keyof GuildSettings>,
    },
    leveling: {
        label: "Leveling",
        description: "Award XP for chatting and let members climb the server leaderboard.",
        fields: [] as Array<keyof GuildSettings>,
    },
    economy: {
        label: "Economy",
        description: "Customize the currency and bank shown by Orchard.",
        fields: [] as Array<keyof GuildSettings>,
    },
    reactionRoles: {
        label: "Reaction roles",
        description: "Create Discord embed menus that grant roles when members react.",
        fields: [] as Array<keyof GuildSettings>,
    },
    verification: {
        label: "Verification",
        description: "Create a reaction-based panel for new members to verify themselves.",
        fields: [] as Array<keyof GuildSettings>,
    },
} as const;

type SystemKey = keyof typeof systemGroups;

const systemNoteOptions: Partial<Record<SystemKey, Array<{ key: string; label: string }>>> = {
    welcome: [
        { key: "welcomeC", label: "Welcome channel" },
        { key: "welcomeMode", label: "Welcome format" },
        { key: "welcomeAvatarPosition", label: "Avatar position" },
        { key: "welcomeBackgroundUrl", label: "Welcome background" },
        { key: "welcomeContent", label: "Welcome content" },
    ],
    birthdays: [
        { key: "birthdayAnnounceChan", label: "Birthday announcements" },
        { key: "birthdayLogChannelId", label: "Birthday logs" },
    ],
    counting: [
        { key: "countingChannel", label: "Counting channel" },
        { key: "countingEnabled", label: "Counting system" },
    ],
    serverStats: [
        { key: "statsCategoryId", label: "Category placement" },
        { key: "statsAllChannel", label: "Total Members channel" },
        { key: "statsUsersChannel", label: "Users channel" },
        { key: "statsBotsChannel", label: "Bots channel" },
        { key: "statsCreateMissing", label: "Create missing channels" },
    ],
    leveling: [
        { key: "levelEnabled", label: "Leveling system" },
        { key: "levelFirstReward", label: "1st place reward" },
        { key: "levelSecondReward", label: "2nd place reward" },
        { key: "levelThirdReward", label: "3rd place reward" },
        { key: "levelParticipantReward", label: "Participation reward" },
    ],
    economy: [
        { key: "economyCurrencyName", label: "Currency name" },
        { key: "economyBankName", label: "Bank name" },
        { key: "economyCurrencyImageUrl", label: "Currency image" },
        { key: "economyBankImageUrl", label: "Bank image" },
        { key: "economyItems", label: "Economy items" },
    ],
    reactionRoles: [{ key: "reactionRolePanels", label: "Reaction role panels" }],
    verification: [
        { key: "verificationChannelId", label: "Verification channel" },
        { key: "introC", label: "Intro channel" },
        { key: "verifiedRole", label: "Verified role" },
        { key: "nonVerifiedRoleId", label: "Non-verified role" },
    ],
};

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

function placementGaps(channels: GuildChannel[], excludedCategoryId: string, selected: string, onSelect: (placement: string) => void) {
    const topLevel = channels.filter((channel) => channel.parent_id === null && channel.id !== excludedCategoryId);
    const ordered = [
        ...topLevel.filter((channel) => channel.type !== 4),
        ...topLevel.filter((channel) => channel.type === 4),
    ].sort((left, right) => {
        const leftGroup = left.type === 4 ? 1 : 0;
        const rightGroup = right.type === 4 ? 1 : 0;
        return leftGroup - rightGroup || (left.position ?? 0) - (right.position ?? 0);
    });
    return ordered.flatMap((channel, index) => {
        const next = ordered[index + 1];
        const items: ReactNode[] = [
            <div key={`channel-${channel.id}`} className="flex items-center gap-2 py-1 text-sm text-slate-300">
                <span className="text-slate-500">{channel.type === 4 ? "▾" : "#"}</span>
                <span>{channel.type === 4 ? channel.name : channel.name}</span>
            </div>,
        ];
        if (next) {
            const placement = `before:${next.id}`;
            items.push(
                <button
                    key={`gap-${next.id}`}
                    type="button"
                    title={`Place server stats before ${next.type === 4 ? next.name : `#${next.name}`}`}
                    aria-label={`Place server stats before ${next.type === 4 ? next.name : next.name}`}
                    onClick={() => onSelect(placement)}
                    className={`my-1 h-3 w-full border-0 border-t-2 transition ${selected === placement ? "border-discord-green" : "border-white/10 hover:border-discord-green/70"}`}
                />,
            );
        }
        return items;
    });
}

function embedFieldsText(value: string) {
    try {
        const fields = JSON.parse(value || "[]") as Array<{ name?: string; value?: string; inline?: boolean }>;
        return fields.map((field) => `${field.name ?? ""} | ${field.value ?? ""}${field.inline ? " | inline" : ""}`).join("\n");
    } catch {
        return "";
    }
}

function embedFieldsJson(value: string) {
    return JSON.stringify(value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, fieldValue, inline] = line.split("|").map((part) => part.trim());
        return { name, value: fieldValue, inline: inline?.toLowerCase() === "inline" };
    }).filter((field) => field.name && field.value));
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
    const [reactionError, setReactionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);
    const [backgroundImageFailed, setBackgroundImageFailed] = useState(false);
    const [reactionPanels, setReactionPanels] = useState<ReactionRolePanel[]>([]);
    const [reactionChannels, setReactionChannels] = useState<GuildChannel[]>([]);
    const [reactionRoles, setReactionRoles] = useState<GuildRole[]>([]);
    const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
    const [reactionTitle, setReactionTitle] = useState("Choose your roles");
    const [reactionDescription, setReactionDescription] = useState("React below to add or remove a role.");
    const [reactionChannelId, setReactionChannelId] = useState("");
    const [reactionEntries, setReactionEntries] = useState<Array<{ roleId: string; emoji: string }>>([{ roleId: "", emoji: "🎮" }]);
    const [reactionSaving, setReactionSaving] = useState(false);
    const [verificationChannelId, setVerificationChannelId] = useState("");
    const [verificationVerifiedRole, setVerificationVerifiedRole] = useState("");
    const [verificationNonVerifiedRole, setVerificationNonVerifiedRole] = useState("");
    const [verificationSaving, setVerificationSaving] = useState(false);
    const [economyCurrencyName, setEconomyCurrencyName] = useState("Coins");
    const [economyBankName, setEconomyBankName] = useState("Bank");
    const [economyCurrencyImageUrl, setEconomyCurrencyImageUrl] = useState("");
    const [economyBankImageUrl, setEconomyBankImageUrl] = useState("");
    const [economyItems, setEconomyItems] = useState<EconomyItemDefinition[]>([]);
    const [newEconomyItem, setNewEconomyItem] = useState({ item: "", game: "scavenger-hunt" as EconomyItemDefinition["game"], value: 10 });
    const [statsAllName, setStatsAllName] = useState("Total Members");
    const [statsUsersName, setStatsUsersName] = useState("Users");
    const [statsBotsName, setStatsBotsName] = useState("Bots");
    const [statsCreateMissing, setStatsCreateMissing] = useState(false);
    const [statsPlacement, setStatsPlacement] = useState("");
    const [systemNote, setSystemNote] = useState("");
    const [optionNotes, setOptionNotes] = useState<Record<string, string>>({});
    const [notesSaving, setNotesSaving] = useState(false);

    useEffect(() => {
        if (!guildId) return;

        getGuildSettings(guildId)
            .then((response) => {
                setGuildName(response.guild.gName);
                setChannels(response.channels);
                setGuildRoles(response.roles);
                setSettings(response.guild);
                setVerificationChannelId(response.guild.verificationChannelId ?? "");
                setVerificationVerifiedRole(response.guild.verifiedRole ?? "");
                setVerificationNonVerifiedRole(response.guild.nonVerifiedRoleId ?? "");
                setEconomyCurrencyName(response.guild.economyCurrencyName ?? "Coins");
                setEconomyBankName(response.guild.economyBankName ?? "Bank");
                setEconomyCurrencyImageUrl(response.guild.economyCurrencyImageUrl ?? "");
                setEconomyBankImageUrl(response.guild.economyBankImageUrl ?? "");
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

    useEffect(() => {
        if (!guildId || activeSystem !== "economy") return;
        getEconomyItems(guildId).then(setEconomyItems).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load economy items."));
    }, [guildId, activeSystem]);

    useEffect(() => {
        if (!guildId || !activeSystem) return;
        getSetupNotes(guildId, activeSystem)
            .then((notes) => { setSystemNote(notes.note); setOptionNotes(notes.options); })
            .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load setup notes."));
    }, [guildId, activeSystem]);

    useEffect(() => {
        if (!guildId || activeSystem !== "reactionRoles") {
            setReactionError(null);
            return;
        }

        getReactionRoles(guildId)
            .then((reactionResponse) => {
                setReactionPanels(reactionResponse.panels);
                setReactionChannels(reactionResponse.channels);
                setReactionRoles(reactionResponse.roles);
                setReactionChannelId(reactionResponse.channels[0]?.id ?? "");
                setReactionError(null);
            })
            .catch((err) => {
                setReactionPanels([]);
                setReactionChannels([]);
                setReactionRoles([]);
                setReactionChannelId("");
                setReactionError(err instanceof ApiError ? err.message : "Failed to load reaction roles.");
            });
    }, [guildId, activeSystem]);

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
    const noteOptions = activeSystem ? systemNoteOptions[activeSystem] ?? [] : [];

    if (unauthorized) return <Unauthorized />;

    const updateSetting = (key: keyof GuildSettings, value: string | boolean | number) => {
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
                economyCurrencyName,
                economyBankName,
                economyCurrencyImageUrl,
                economyBankImageUrl,
                statsCreateMissing,
                statsAllName,
                statsUsersName,
                statsBotsName,
                statsPlacement,
            });
            setNotice("Guild settings saved.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to save guild settings.");
        } finally {
            setSaving(false);
        }
    };

    const saveNotes = async () => {
        if (!guildId || !activeSystem) return;
        setNotesSaving(true);
        try {
            await saveSetupNotes(guildId, activeSystem, { note: systemNote, options: optionNotes });
            setNotice("Setup notes saved.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to save setup notes.");
        } finally {
            setNotesSaving(false);
        }
    };

    const disableSystem = async () => {
        if (!guildId || !activeSystem) return;
        if (!window.confirm(`Disable ${systemGroups[activeSystem].label}? This removes its stored configuration.`)) return;
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            await disableGuildSystem(guildId, activeSystem);
            setNotice(`${systemGroups[activeSystem].label} disabled and removed.`);
            window.location.reload();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to disable system.");
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

    const saveReactionPanel = async () => {
        if (!guildId || !reactionChannelId || reactionEntries.some((entry) => !entry.roleId || !entry.emoji.trim())) return;
        setReactionSaving(true);
        try {
            const created = await createReactionRolePanel(guildId, { channelId: reactionChannelId, title: reactionTitle, description: reactionDescription, entries: reactionEntries });
            setReactionPanels((current) => [...current, created.panel]);
            setNotice("Reaction role embed created.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to create reaction role embed.");
        } finally {
            setReactionSaving(false);
        }
    };

    const removeReactionPanel = async (panelId: string) => {
        if (!guildId) return;
        try {
            await deleteReactionRolePanel(guildId, panelId);
            setReactionPanels((current) => current.filter((panel) => panel.id !== panelId));
            setNotice("Reaction role embed deleted.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to delete reaction role embed.");
        }
    };

    const saveVerificationPanel = async () => {
        if (!guildId || !verificationChannelId || !verificationVerifiedRole || !verificationNonVerifiedRole) {
            setError("Choose a verification channel, verified role, and non-verified role first.");
            return;
        }
        setVerificationSaving(true);
        setError(null);
        try {
            await createVerificationPanel(guildId, { channelId: verificationChannelId, verifiedRole: verificationVerifiedRole, nonVerifiedRoleId: verificationNonVerifiedRole });
            setSettings((current) => ({ ...current, verifiedRole: verificationVerifiedRole, nonVerifiedRoleId: verificationNonVerifiedRole, verificationPanelMessageId: "created" }));
            setNotice("Verification panel created.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to create verification panel.");
        } finally {
            setVerificationSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1d29,_#0b0d12)]">
            <Navbar />
            <main className="mx-auto max-w-6xl px-6 py-10">
                {guildId && <GuildNavigationMenu guildId={guildId} showSystemsLink={Boolean(activeSystem)} />}

                {loading && <div className="flex items-center gap-3 py-20 text-slate-400"><Spinner /> Loading guild settings…</div>}
                {error && <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
                {reactionError && !loading && (
                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        {reactionError}
                    </div>
                )}

                {!loading && !error && (
                    <>
                        <header className="mt-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
                            <div>
                                {!activeSystem && <span className="text-xs font-semibold uppercase tracking-[0.25em] text-discord-green">Guild control</span>}
                                <h1 className="mt-3 text-3xl font-semibold text-white">{activeSystem ? systemGroups[activeSystem].label : guildName}</h1>
                                <p className="mt-2 text-slate-400">{activeSystem ? systemGroups[activeSystem].description : "Configure Orchard systems and the channels they use."}</p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-3">
                                {activeSystem && <button type="button" onClick={() => void disableSystem()} disabled={saving} className="rounded-lg border border-red-400/40 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:border-red-300 hover:text-red-200 disabled:cursor-wait disabled:opacity-60">Disable system</button>}
                                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-discord-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-discord-green/90 disabled:cursor-wait disabled:opacity-60">
                                    {saving ? "Saving…" : "Save changes"}
                                </button>
                            </div>
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

                        {activeSystem && activeSystem !== "reactionRoles" && <section className="mt-8 grid gap-5 md:grid-cols-2">
                            {channelFields.filter((field) => systemGroups[activeSystem].fields.includes(field.key)).map((field) => (
                                <label key={field.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                    <span className="block font-semibold text-white">{field.label}</span>
                                    <span className="mt-1 block text-sm text-slate-400">{field.description}</span>
                                    <select
                                        value={String(settings[field.key] ?? "")}
                                        onChange={(event) => updateSetting(field.key, event.target.value)}
                                        className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white outline-none transition focus:border-discord-blurple"
                                    >
                                        {channelOptions(channels.filter((channel) => channel.type === 0))}
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

                        {activeSystem && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <div>
                                    <h2 className="font-semibold text-white">Setup notes</h2>
                                    <p className="mt-1 text-sm text-slate-400">Add a note for this system and each option. Notes are saved for administrators managing this guild.</p>
                                </div>
                                <button type="button" onClick={() => void saveNotes()} disabled={notesSaving} className="rounded-lg bg-discord-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{notesSaving ? "Saving…" : "Save notes"}</button>
                            </div>
                            <label className="mt-4 block text-sm text-slate-300">System note
                                <textarea value={systemNote} onChange={(event) => setSystemNote(event.target.value)} rows={2} placeholder={`Notes about ${systemGroups[activeSystem].label.toLowerCase()}`} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                            </label>
                            {noteOptions.length > 0 && <div className="mt-4 grid gap-4 md:grid-cols-2">
                                {noteOptions.map((option) => <label key={option.key} className="block text-sm text-slate-300">{option.label} note
                                    <textarea value={optionNotes[option.key] ?? ""} onChange={(event) => setOptionNotes((current) => ({ ...current, [option.key]: event.target.value }))} rows={2} placeholder={`Notes about ${option.label.toLowerCase()}`} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                </label>)}
                            </div>}
                        </section>}

                        {activeSystem === "reactionRoles" && <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">New reaction role embed</h2>
                                <p className="mt-1 text-sm text-slate-400">Create one Discord message with multiple emoji-to-role mappings.</p>
                                <select value={reactionChannelId} onChange={(event) => setReactionChannelId(event.target.value)} className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                    <option value="">Choose a channel</option>
                                    {reactionChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                                </select>
                                <input value={reactionTitle} onChange={(event) => setReactionTitle(event.target.value)} placeholder="Embed title" className="mt-3 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <textarea value={reactionDescription} onChange={(event) => setReactionDescription(event.target.value)} placeholder="Embed description" rows={3} className="mt-3 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <div className="mt-4 space-y-3">
                                    {reactionEntries.map((entry, index) => <div key={index} className="grid grid-cols-[72px_1fr] gap-2">
                                        <input value={entry.emoji} onChange={(event) => setReactionEntries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, emoji: event.target.value } : item))} placeholder="🎮" className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-center text-white" />
                                        <select value={entry.roleId} onChange={(event) => setReactionEntries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, roleId: event.target.value } : item))} className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white"><option value="">Choose a role</option>{reactionRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select>
                                    </div>)}
                                </div>
                                {reactionEntries.length < 20 && <button type="button" onClick={() => setReactionEntries((current) => [...current, { roleId: "", emoji: "" }])} className="mt-3 text-sm font-semibold text-discord-green">+ Add another reaction</button>}
                                <button type="button" onClick={() => void saveReactionPanel()} disabled={reactionSaving} className="mt-5 w-full rounded-lg bg-discord-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{reactionSaving ? "Posting embed…" : "Post reaction role embed"}</button>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-[#1e1f22] bg-[#313338] text-[#dbdee1] shadow-xl">
                                <div className="flex items-center gap-2 border-b border-[#1e1f22] bg-[#2b2d31] px-4 py-3"><span className="text-xl text-[#949ba4]">#</span><span className="font-semibold text-white">{reactionChannels.find((channel) => channel.id === reactionChannelId)?.name || "roles"}</span><span className="ml-auto text-xs text-[#949ba4]">Example message</span></div>
                                <div className="flex gap-3 p-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5865f2] font-bold text-white">P</div><div><div className="flex items-center gap-2"><span className="font-semibold text-white">Pomona</span><span className="rounded bg-[#5865f2] px-1 py-0.5 text-[0.65rem] font-semibold text-white">BOT</span></div><h3 className="mt-2 text-lg font-semibold text-white">{reactionTitle || "Choose your roles"}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-[#b5bac1]">{reactionDescription || "React below to add or remove a role."}</p><div className="mt-4 flex flex-wrap gap-2">{reactionEntries.filter((entry) => entry.emoji.trim()).map((entry, index) => <span key={index} className="rounded bg-[#2b2d31] px-2 py-1 text-lg">{entry.emoji}</span>)}</div></div></div>
                            </div>
                            {reactionPanels.length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-semibold text-white">Posted panels</h3><div className="mt-3 space-y-2">{reactionPanels.map((panel) => <div key={panel.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-slate-300">{panel.title}</span><div className="flex shrink-0 items-center gap-3"><span className="font-mono text-xs text-discord-green">{panel.id}</span><button type="button" onClick={() => void removeReactionPanel(panel.id)} className="text-xs font-semibold text-red-300 hover:text-red-200">Delete</button></div></div>)}</div></div>}
                        </section>}

                        {activeSystem === "economy" && <section className="mt-8 max-w-2xl space-y-5">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">Economy customization</h2>
                                <p className="mt-1 text-sm text-slate-400">Choose the names and optional images used for currency and bank balances.</p>
                                <label className="mt-4 block text-sm text-slate-300">Currency name<input value={economyCurrencyName} onChange={(event) => setEconomyCurrencyName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-white" /></label>
                                <label className="mt-4 block text-sm text-slate-300">Bank name<input value={economyBankName} onChange={(event) => setEconomyBankName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-white" /></label>
                                <label className="mt-4 block text-sm text-slate-300">Currency image URL<input type="url" value={economyCurrencyImageUrl} onChange={(event) => setEconomyCurrencyImageUrl(event.target.value)} placeholder="https://example.com/currency.png" className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-white" /></label>
                                <label className="mt-4 block text-sm text-slate-300">Bank image URL<input type="url" value={economyBankImageUrl} onChange={(event) => setEconomyBankImageUrl(event.target.value)} placeholder="https://example.com/bank.png" className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-white" /></label>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">Server item catalog</h2>
                                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_7rem_auto]">
                                    <input value={newEconomyItem.item} onChange={(event) => setNewEconomyItem((current) => ({ ...current, item: event.target.value }))} placeholder="Item name" className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                    <select value={newEconomyItem.game} onChange={(event) => setNewEconomyItem((current) => ({ ...current, game: event.target.value as EconomyItemDefinition["game"] }))} className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white"><option value="scavenger-hunt">Scavenger</option><option value="fishing">Fishing</option><option value="farming">Farming</option></select>
                                    <input type="number" min={1} value={newEconomyItem.value} onChange={(event) => setNewEconomyItem((current) => ({ ...current, value: Number(event.target.value) }))} className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                    <button type="button" onClick={() => { if (!guildId || !newEconomyItem.item.trim()) return; void createEconomyItem(guildId, newEconomyItem).then((item) => { setEconomyItems((current) => [...current.filter((entry) => entry.id !== item.id), item]); setNewEconomyItem({ item: "", game: "scavenger-hunt", value: 10 }); }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to add economy item.")); }} className="rounded-lg bg-discord-green px-3 py-2 text-sm font-semibold text-white">Add</button>
                                </div>
                                <div className="mt-5 space-y-2">
                                    {economyItems.map((item) => <div key={item.id} className="grid items-center gap-2 sm:grid-cols-[1fr_9rem_7rem_auto]">
                                        <span className="text-sm text-white">{item.item}</span>
                                        <select value={item.game} onChange={(event) => { if (!guildId) return; void updateEconomyItem(guildId, item.id, { game: event.target.value as EconomyItemDefinition["game"] }).then((updated) => setEconomyItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry))).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to update economy item.")); }} className="rounded-lg border border-white/15 bg-[#121722] px-2 py-2 text-xs text-white"><option value="scavenger-hunt">Scavenger</option><option value="fishing">Fishing</option><option value="farming">Farming</option></select>
                                        <input type="number" min={1} value={item.value} onChange={(event) => { if (!guildId) return; void updateEconomyItem(guildId, item.id, { value: Number(event.target.value) }).then((updated) => setEconomyItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry))).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to update economy item.")); }} className="rounded-lg border border-white/15 bg-[#121722] px-2 py-2 text-xs text-white" />
                                        <button type="button" onClick={() => { if (!guildId) return; void deleteEconomyItem(guildId, item.id).then(() => setEconomyItems((current) => current.filter((entry) => entry.id !== item.id))).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to delete economy item.")); }} className="text-xs font-semibold text-red-300 hover:text-red-200">Remove</button>
                                    </div>)}
                                </div>
                            </div>
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

                        {activeSystem === "serverStats" && <section className="mt-5 space-y-5">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">Category placement</h2>
                                <p className="mt-1 text-sm text-slate-400">Choose the exact gap where the server stats category should be placed.</p>
                                <div className="mt-4 rounded-lg border border-white/10 bg-[#121722] p-3">
                                    {placementGaps(channels, String(settings.statsCategoryId ?? ""), statsPlacement, setStatsPlacement)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">Server stats voice channels</h2>
                                <p className="mt-1 text-sm text-slate-400">Choose existing voice channels or create missing ones. Members can see them but cannot connect; non-verified members cannot see them.</p>
                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    {([["statsAllChannel", "Total Members"], ["statsUsersChannel", "Users"], ["statsBotsChannel", "Bots"]] as Array<[keyof GuildSettings, string]>).map(([key, label]) => <label key={key} className="block text-sm text-slate-300">{label}
                                        <select value={String(settings[key] ?? "")} onChange={(event) => updateSetting(key, event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                            {channelOptions(channels.filter((channel) => channel.type === 2))}
                                        </select>
                                    </label>)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <h2 className="font-semibold text-white">Create missing channels</h2>
                                <p className="mt-1 text-sm text-slate-400">The bot will create voice channels with these names and apply the verified/non-verified visibility rules.</p>
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    <input value={statsAllName} onChange={(event) => setStatsAllName(event.target.value)} placeholder="Total Members" className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                    <input value={statsUsersName} onChange={(event) => setStatsUsersName(event.target.value)} placeholder="Users" className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                    <input value={statsBotsName} onChange={(event) => setStatsBotsName(event.target.value)} placeholder="Bots" className="rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                </div>
                                <label className="mt-4 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={statsCreateMissing} onChange={(event) => setStatsCreateMissing(event.target.checked)} className="h-5 w-5 accent-discord-green" />Create any missing channels when saving</label>
                                <p className="mt-3 text-xs text-slate-500">Configure the verified and non-verified roles in your guild settings before creating channels.</p>
                            </div>
                        </section>}

                        {activeSystem === "verification" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <h2 className="font-semibold text-white">Verification panel</h2>
                            <p className="mt-1 text-sm text-slate-400">Post a panel that assigns the verified role when a member reacts with any emoji.</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <label className="block text-sm text-slate-300">Verification channel
                                    <select value={verificationChannelId} onChange={(event) => setVerificationChannelId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                        {channelOptions(channels.filter((channel) => channel.type === 0))}
                                    </select>
                                </label>
                                <label className="block text-sm text-slate-300">Intro channel
                                    <select value={String(settings.introC ?? "")} onChange={(event) => updateSetting("introC", event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                        {channelOptions(channels.filter((channel) => channel.type === 0))}
                                    </select>
                                </label>
                                <label className="block text-sm text-slate-300">Verified role
                                    <select value={verificationVerifiedRole} onChange={(event) => setVerificationVerifiedRole(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                        <option value="">Choose a role</option>{guildRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                                    </select>
                                </label>
                                <label className="block text-sm text-slate-300">Non-verified role
                                    <select value={verificationNonVerifiedRole} onChange={(event) => setVerificationNonVerifiedRole(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                        <option value="">Choose a role</option>{guildRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                                    </select>
                                </label>
                            </div>
                            <button type="button" onClick={() => void saveVerificationPanel()} disabled={verificationSaving || Boolean(settings.verificationPanelMessageId)} className="mt-5 rounded-lg bg-discord-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{verificationSaving ? "Posting panel…" : settings.verificationPanelMessageId ? "Panel already posted" : "Create verification panel"}</button>
                        </section>}

                        {activeSystem === "leveling" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block font-semibold text-white">Leveling system</span>
                                    <span className="mt-1 block text-sm text-slate-400">Award XP for chatting and enable the /level rank and leaderboard commands.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.levelEnabled)}
                                    onChange={(event) => updateSetting("levelEnabled", event.target.checked)}
                                    className="h-5 w-5 accent-discord-green"
                                />
                            </label>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {([["levelFirstReward", "1st place XP", 1200], ["levelSecondReward", "2nd place XP", 900], ["levelThirdReward", "3rd place XP", 700], ["levelParticipantReward", "Top 10 participation coins", 100]] as Array<[keyof GuildSettings, string, number]>).map(([key, label, fallback]) => <label key={key} className="block text-sm text-slate-300">{label}<input type="number" min={0} value={Number(settings[key] ?? fallback)} onChange={(event) => updateSetting(key, Number(event.target.value))} className="mt-2 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" /></label>)}
                            </div>
                        </section>}

                        {activeSystem === "welcome" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <h2 className="font-semibold text-white">Welcome format</h2>
                            <p className="mt-1 text-sm text-slate-400">Preview and choose how new members receive the welcome.</p>
                            <select value={settings.welcomeMode ?? "image"} onChange={(event) => updateSetting("welcomeMode", event.target.value as WelcomeMode)} className="mt-4 w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white">
                                <option value="text">Regular message</option>
                                <option value="embed">Embed</option>
                                <option value="image">Image welcome</option>
                                <option value="container">Editable container</option>
                            </select>
                            {settings.welcomeMode === "embed" && <div className="mt-4 space-y-3">
                                <input value={settings.welcomeEmbedTitle ?? ""} onChange={(event) => updateSetting("welcomeEmbedTitle", event.target.value)} placeholder="Embed title" className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <textarea value={settings.welcomeEmbedDescription ?? ""} onChange={(event) => updateSetting("welcomeEmbedDescription", event.target.value)} placeholder="Embed description. Use {member} and {guild}." rows={4} className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <input value={settings.welcomeEmbedAuthor ?? ""} onChange={(event) => updateSetting("welcomeEmbedAuthor", event.target.value)} placeholder="Author name (optional)" className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <textarea value={embedFieldsText(settings.welcomeEmbedFields ?? "[]")} onChange={(event) => updateSetting("welcomeEmbedFields", embedFieldsJson(event.target.value))} placeholder="Fields: Name | Value | inline" rows={4} className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(settings.welcomeEmbedTimestamp)} onChange={(event) => updateSetting("welcomeEmbedTimestamp", event.target.checked)} className="h-5 w-5 accent-discord-green" />Add timestamp</label>
                                <label className="block text-sm text-slate-300">Embed color<input type="color" value={settings.welcomeEmbedColor ?? "#5865F2"} onChange={(event) => updateSetting("welcomeEmbedColor", event.target.value)} className="mt-2 h-10 w-full rounded-lg bg-[#121722]" /></label>
                                <div className="rounded-lg border-l-4 p-4" style={{ borderColor: settings.welcomeEmbedColor ?? "#5865F2" }}><h3 className="font-semibold text-white">{settings.welcomeEmbedTitle || "Welcome!"}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{(settings.welcomeEmbedDescription || welcomePreviewMessage).replaceAll("{member}", `@${user?.username || "new-member"}`).replaceAll("{guild}", guildName || "your server")}</p></div><button type="button" className="mt-4 rounded-[3px] bg-[#4e5058] px-3 py-1.5 text-sm font-medium text-white">👋 Wave to say hi!</button>
                            </div>}
                            {settings.welcomeMode === "text" && <div className="mt-4 rounded-lg bg-[#121722] p-4 text-sm text-slate-200">{welcomePreviewMessage}<button type="button" className="mt-4 block rounded-[3px] bg-[#4e5058] px-3 py-1.5 text-sm font-medium text-white">👋 Wave to say hi!</button></div>}
                            {settings.welcomeMode === "container" && <div className="mt-4 rounded-xl border border-white/15 bg-[#1e1f22] p-4 text-sm text-slate-200"><div className="rounded-lg border border-white/10 bg-[#313338] p-4">{welcomePreviewMessage}<button type="button" className="mt-4 block rounded-[3px] bg-[#4e5058] px-3 py-1.5 text-sm font-medium text-white">👋 Wave to say hi!</button></div></div>}
                            {settings.welcomeMode === "container" && <div className="mt-4 space-y-3">
                                <textarea value={settings.welcomeContainerExtraText ?? ""} onChange={(event) => updateSetting("welcomeContainerExtraText", event.target.value)} placeholder="Extra container text" rows={3} className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <input value={settings.welcomeContainerImageUrl ?? ""} onChange={(event) => updateSetting("welcomeContainerImageUrl", event.target.value)} placeholder="Single image URL (optional)" className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <textarea value={settings.welcomeContainerGalleryUrls ?? ""} onChange={(event) => updateSetting("welcomeContainerGalleryUrls", event.target.value)} placeholder="Gallery image URLs, one per line" rows={3} className="w-full rounded-lg border border-white/15 bg-[#121722] px-3 py-2.5 text-sm text-white" />
                                <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={settings.welcomeContainerSeparators !== false} onChange={(event) => updateSetting("welcomeContainerSeparators", event.target.checked)} className="h-5 w-5 accent-discord-green" />Use separators between container sections</label>
                            </div>}
                        </section>}

                        {activeSystem === "welcome" && (settings.welcomeMode ?? "image") === "image" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
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

                        {activeSystem === "welcome" && settings.welcomeMode !== "embed" && <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <span className="mt-3 block font-semibold text-white">{settings.welcomeMode === "container" ? "Container content" : settings.welcomeMode === "text" ? "Regular message" : "Image welcome message"}</span>
                            <span className="mt-1 block text-sm text-slate-400">Edit the content sent with this welcome format.</span>
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
