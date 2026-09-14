import type { Guild } from "@orchard/types";
import { Link } from "react-router-dom";

export function GuildCard({ guild }: { guild: Guild }) {
  const canUseBot = guild.administrator;
  const permissionError = "You need Administrator permissions to use Orchard in this server.";
  const initials = guild.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 transition ${canUseBot ? "group hover:border-white/20 hover:bg-white/[0.08]" : "opacity-60"
        }`}
    >
      <div className="flex items-center gap-3">
        {guild.icon ? (
          <img src={guild.icon} alt={guild.name} className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-discord-blurple/20 text-sm font-semibold text-discord-blurple">
            {initials}
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{guild.name}</p>
            <p className="text-xs text-slate-400">{guild.owner ? "Owner" : "Member"}</p>
          </div>
          {!canUseBot && (
            <span
              title={permissionError}
              aria-label={permissionError}
              className="grid h-5 w-5 shrink-0 place-items-center [clip-path:polygon(50%_0,100%_100%,0_100%)] bg-yellow-400 text-[11px] font-bold text-slate-950"
            >
              !
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {!canUseBot ? (
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-500"
          >
            Unavailable
          </button>
        ) : guild.botInGuild ? (
          <Link
            to={`/dashboard/guilds/${guild.id}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-discord-green px-3 py-2 text-xs font-semibold text-white transition hover:bg-discord-green/90"
          >
            Manage
          </Link>
        ) : (
          <a
            href={guild.inviteUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-discord-blurple px-3 py-2 text-xs font-semibold text-white transition hover:bg-discord-blurple/90"
          >
            + Invite
          </a>
        )}
      </div>
    </div>
  );
}
