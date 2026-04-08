import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

export default function DiscordCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(h);
    const token = params.get("token");
    const username = params.get("username");
    if (token && username) {
      login(token, username);
      window.history.replaceState(null, "", "/auth/discord/callback");
      navigate("/", { replace: true });
      return;
    }
    setMsg("Could not complete sign-in. Redirecting…");
    navigate("/login?error=discord_bad_token", { replace: true });
  }, [login, navigate]);

  return (
    <div className="auth-page">
      <p className="status-msg">{msg}</p>
    </div>
  );
}
