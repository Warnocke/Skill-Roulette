import React, { useState } from "react";
import { signInWithEmail, signUpWithEmail } from "../lib/dbHelpers";
import '../styles/LoginPage.css';

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");

    const { user, error } = await signInWithEmail({ email, password });
    if (error) return setError(error.message);

    window.location.href = "/";
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");

    const { user, error } = await signUpWithEmail({
      email,
      password,
      displayName
    });
    if (error) return setError(error.message);

    window.location.href = "/";
  }

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="logo-container">
          <img src="/elements/SR_logo.png" alt="Skill Roulette Logo" className="auth-logo" />
        </div>

        {mode === "signin" && (
          <div className="auth-box">
            <h2>Sign In</h2>

            <form onSubmit={handleSignIn}>
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="error-text">{error}</p>}

              <button type="submit">Sign In</button>
            </form>

            <p className="toggle-text">
              Don't have an account?{" "}
              <span onClick={() => setMode("signup")}>Create one</span>
            </p>
          </div>
        )}

        {mode === "signup" && (
          <div className="auth-box">
            <h2>Create Account</h2>

            <form onSubmit={handleSignUp}>
              <input
                type="text"
                placeholder="Display Name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="error-text">{error}</p>}

              <button type="submit">Create Account</button>
            </form>

            <p className="toggle-text">
              Already have an account?{" "}
              <span onClick={() => setMode("signin")}>Sign in</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
