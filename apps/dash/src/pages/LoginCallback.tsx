import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/Spinner";

export function LoginCallback() {
  const { login } = useAuth();
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("token");

    if (!token) {
      setStatus("error");
      return;
    }

    login(token)
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
  }, [login]);

  if (status === "error") {
    return <Navigate to="/login?error=auth_failed" replace />;
  }

  if (status === "done") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center gap-3 text-slate-300">
      <Spinner />
      Signing you in…
    </div>
  );
}
