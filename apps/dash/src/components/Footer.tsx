import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="font-semibold text-slate-300 transition hover:text-white">Orchard</Link>
          <span className="ml-2">Community infrastructure for Discord.</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/dashboard" className="transition hover:text-white">Dashboard</Link>
          <Link to="/health" className="transition hover:text-white">System health</Link>
          <Link to="/privacy" className="transition hover:text-white">Privacy</Link>
          <Link to="/terms" className="transition hover:text-white">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
