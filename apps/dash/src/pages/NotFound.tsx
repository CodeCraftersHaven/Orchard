import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-discord-dark text-center">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-4xl font-bold text-white">404</h1>
        <p className="text-slate-400">This page doesn&apos;t exist.</p>
        <Link to="/" className="text-discord-blurple hover:underline">
          Go home
        </Link>
      </main>
    </div>
  );
}
