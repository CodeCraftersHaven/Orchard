import { Link } from "react-router-dom";

type GuildNavigationMenuProps = {
    guildId: string;
    showSystemsLink: boolean;
};

export function GuildNavigationMenu({ guildId, showSystemsLink }: GuildNavigationMenuProps) {
    const backTo = showSystemsLink ? `/dashboard/guilds/${guildId}` : "/dashboard";
    const backLabel = showSystemsLink ? "Back to systems" : "Back to servers";

    return (
        <Link
            to={backTo}
            aria-label={backLabel}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path d="M12.5 4.5 6 10l6.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {backLabel}
        </Link>
    );
}

