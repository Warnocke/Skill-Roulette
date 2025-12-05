// src/components/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { getCurrentUserProfile } from "../lib/dbHelpers";
import supabase from "../supabaseClient";
import "../styles/profile.css";

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [postsCount, setPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      const { profile: p, error: pErr } = await getCurrentUserProfile();
      if (!mounted) return;
      if (pErr) {
        setError(pErr);
        setLoading(false);
        return;
      }
      setProfile(p);

      // Fetch posts count for this user
      try {
        const { data, count, error: countError } = await supabase
          .from("posts")
          .select("id", { count: "exact" })
          .eq("user_id", p.id);

        if (countError) {
          setError(countError);
        } else {
          // supabase may return `count`; fallback to data length
          setPostsCount(typeof count === "number" ? count : (data ? data.length : 0));
        }
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-card">Error: {String(error.message ?? error)}</div>
      </div>
    );
  }

  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "";

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar--placeholder">{(profile?.display_name || "?").charAt(0).toUpperCase()}</div>
          )}

          <div className="profile-meta">
            <h2 className="profile-name">{profile?.display_name ?? "Unnamed"}</h2>
            <div className="profile-joined">Joined: {joined}</div>
            <div className="profile-posts">{postsCount} posts</div>
          </div>
        </div>

        <div className="profile-bio">{profile?.bio ?? "No bio yet."}</div>
      </div>
    </div>
  );
};

export default ProfilePage;
