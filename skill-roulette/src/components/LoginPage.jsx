// src/components/LoginPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [who, setWho] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep session in component state + listen to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setWho(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setWho(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();              // IMPORTANT: stop full page reload
    setMsg("");
    setLoading(true);
    console.log("[Login] submit clicked with", { email }); // instrumentation

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[Login] error:", error);
      setMsg(error.message);
    } else {
      console.log("[Login] success");
      setMsg("Logged in successfully!");
    }
    setLoading(false);
  }

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setMsg("Logged out.");
    setLoading(false);
  }

  return (
    <div>
      <header>
        <img src="/elements/SR_logo.png" className="logo" alt="Skill Roulette Logo" />
        <nav className="navigation">
          <a href="#">Home</a>
          <a href="#">About</a>
          <button className="btnLogin-popup">Login</button>
        </nav>
      </header>

      <div className="wrapper">
        <div className="form-box login">
          <h2>Login</h2>

          <form onSubmit={handleSubmit} id="loginForm">
            <div className="input-box">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label>Email</label>
            </div>

            <div className="input-box">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label>Password</label>
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {msg && <p style={{ color: "white", marginTop: 10 }}>{msg}</p>}
          {who && (
            <>
              <p style={{ color: "white", marginTop: 10 }}>
                Logged in as: <strong>{who.email}</strong>
              </p>
              <button className="btn" style={{ marginTop: 10 }} onClick={handleLogout} disabled={loading}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
