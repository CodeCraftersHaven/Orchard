import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { avatarUrl } from "../lib/api";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-discord-dark/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-discord-blurple text-sm">🌳</span>
          Orchard
        </Link>

        {/* <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <Link to="/" className="transition hover:text-white">
            Home
          </Link>
          {user ? (
            <Link to="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="transition hover:text-white">
              Login
            </Link>
          )}
        </nav>
 */}
        {user ? (
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl(user)}
              alt={user.username}
              className="h-8 w-8 rounded-full ring-2 ring-white/10"
            />
            <span className="hidden text-sm text-slate-300 sm:inline">
              {user.globalName ?? user.username}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              Log out
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-discord-blurple px-3 py-2 text-sm font-medium text-white shadow-lg shadow-discord-blurple/20 transition hover:bg-discord-blurple/90"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
