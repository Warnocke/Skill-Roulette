import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmail,
  signUpWithEmail,
  getCurrentUserProfile,
  updateCurrentUserProfile
} from "../lib/dbHelpers";
import { useAuth } from "../contexts/Auth";
import supabase from "../supabaseClient";
import Logo from "./Logo";
import "../styles/LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();

  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null); // ⭐ NEW
  const [error, setError] = useState("");
  const navigate = useNavigate();

  /* ---------------------------------------------------------
     SIGN IN
  ----------------------------------------------------------*/
  async function handleSignIn(e) {
    e.preventDefault();
    setError("");

    const { user, error } = await signInWithEmail({ email, password });
    if (error) return setError(error.message);

    // store minimal info in context
    login({ displayName: user.displayName, email: user.email });

    await getCurrentUserProfile();
    navigate("feed");
  }

  /* ---------------------------------------------------------
     SIGN UP WITH PROFILE PICTURE SUPPORT
  ----------------------------------------------------------*/
  async function handleSignUp(e) {
  e.preventDefault();
  setError("");

  // 1. Create account
  const { user, error } = await signUpWithEmail({
    email,
    password,
    displayName,
  });

  if (error) return setError(error.message);

  // 2. Explicitly log the user in after signup (fixes your issue)
  const { user: signedInUser, error: signInError } = await signInWithEmail({
    email,
    password,
  });

  if (signInError) {
    console.error("Sign-in after signup failed:", signInError);
    return setError("Account created, but login failed. Try signing in.");
  }

  // 3. Wait for guaranteed session (now authenticated)
  const authedUser = signedInUser;

  // 4. Ensure profile exists
  const { profile } = await getCurrentUserProfile();

  // 5. Upload avatar if provided
  let avatarUrl = null;

  if (avatarFile) {
    const fileName = `${authedUser.id}/${Date.now()}_${avatarFile.name}`;

    // Upload to the real bucket ("avatars")
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, avatarFile);

    if (uploadError) {
      console.error("Avatar upload failed:", uploadError);
    } else {
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      avatarUrl = publicUrl;
    }
  }

  // 6. Update profile with avatar URL
  if (avatarUrl) {
    await updateCurrentUserProfile({ avatarUrl });
  }

  // 7. Redirect to feed
  navigate("feed");
}

  return (
    <div className="auth-container">
      <Logo />
      <div className="auth-wrapper">

        {/* ---------------------------------------------
            SIGN IN FORM
        ------------------------------------------------*/}
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

        {/* ---------------------------------------------
            SIGN UP FORM (WITH AVATAR)
        ------------------------------------------------*/}
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

              {/* ⭐ PROFILE PICTURE INPUT */}
              <label className="file-label">Upload Profile Picture</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files[0])}
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