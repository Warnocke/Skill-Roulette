// src/dev/DbHelpersTestPage.jsx
// Debug / smoke-test page for dbHelpers.js.
// This is NOT for production; it's a dev tool so you (and teammates)
// can click buttons and see if each helper works end-to-end.

import React, { useState } from "react";
import {
  // Section 1: Auth & Profiles
  signUpWithEmail,
  signInWithEmail,
  signOut,
  getCurrentUser,
  getCurrentUserProfile,
  updateCurrentUserProfile,

  // Section 2: Prompts
  getTodayPrompts,
  getUserPromptForDate,
  setUserPromptForDate,

  // Section 3: Posts
  uploadPostImage,
  createPost,
  getGlobalFeed,

  // Section 4: Reactions & Comments
  likePost,
  unlikePost,
  hasUserLikedPost,
  getPostLikes,
  addComment,
  getCommentsForPost,
  deleteComment,
  
  // Section 5: Avatar Upload
  uploadAvatarImage,
  getAvatarPublicUrl,
} from "../lib/dbHelpers";

function DbHelpersTestPage() {
  const [log, setLog] = useState([]);

  // Auth/Profile state
  const [testEmail, setTestEmail] = useState("test@example.com");
  const [testPassword, setTestPassword] = useState("Test1234!");
  const [displayName, setDisplayName] = useState("Skill Roulette Tester");
  const [bio, setBio] = useState("CS student testing dbHelpers.");
  const [avatarFile, setAvatarFile] = useState(null);

  // Prompts state
  const [todayPrompts, setTodayPromptsState] = useState([]);

  // Posts state
  const [file, setFile] = useState(null);
  const [lastFeedPosts, setLastFeedPosts] = useState([]);
  const [targetPostId, setTargetPostId] = useState("");

  // Comments state
  const [commentText, setCommentText] = useState("");

  function addLog(label, data) {
    setLog((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        label,
        data,
      },
    ]);
  }

  // 1) AUTH TESTS -----------------------------------------------------------

  async function handleSignUp() {
    const { user, error } = await signUpWithEmail({
      email: testEmail,
      password: testPassword,
      displayName,
    });
    addLog("signUpWithEmail", { user, error });
  }

  async function handleSignIn() {
    const { user, error } = await signInWithEmail({
      email: testEmail,
      password: testPassword,
    });
    addLog("signInWithEmail", { user, error });
  }

  async function handleSignOut() {
    const { error } = await signOut();
    addLog("signOut", { error });
  }

  async function handleGetCurrentUser() {
    const { user, error } = await getCurrentUser();
    addLog("getCurrentUser", { user, error });
  }

  async function handleGetCurrentUserProfile() {
    const { profile, error } = await getCurrentUserProfile();
    addLog("getCurrentUserProfile", { profile, error });
  }

  async function handleUpdateProfile() {
    const { profile, error } = await updateCurrentUserProfile({
      displayName,
      bio,
      // avatarUrl: null  // leave as-is for now
    });
    addLog("updateCurrentUserProfile", { profile, error });
  }

  // 2) PROMPTS & DAILY PROMPT TESTS ----------------------------------------

  async function handleGetTodayPrompts() {
    const { prompts, error } = await getTodayPrompts();
    setTodayPromptsState(prompts);
    addLog("getTodayPrompts", { prompts, error });

    if (!error && (!prompts || prompts.length === 0)) {
      addLog("WARNING", {
        message:
          "No prompts found for today. Insert some rows in `prompts` with active_on = today.",
      });
    }
  }

  async function handleSetTodayPromptFromFirst() {
    const { prompts, error: promptsError } = await getTodayPrompts();
    if (promptsError) {
      addLog("setUserPromptForDate", { error: promptsError });
      return;
    }
    if (!prompts || prompts.length === 0) {
      addLog("setUserPromptForDate", {
        error: "No prompts for today; cannot set daily prompt.",
      });
      return;
    }
    // Using the first prompt in the returned list (newest or oldest depending on your sort)
    const first = prompts[0];
    const { record, error } = await setUserPromptForDate({
      promptId: first.id,
      source: "spin",
    });
    addLog("setUserPromptForDate (using first prompt)", { record, error });
  }

  async function handleGetUserPromptForToday() {
    const { record, error } = await getUserPromptForDate();
    addLog("getUserPromptForDate (today)", { record, error });
  }

  // 3) POSTS & GLOBAL FEED TESTS -------------------------------------------

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
  }

  async function handleUploadImageAndCreatePost() {
    if (!file) {
      addLog("uploadPostImage", { error: "No file selected." });
      return;
    }

    // Need a chosen promptId for the post.
    let promptId = null;

    if (todayPrompts.length > 0) {
      promptId = todayPrompts[0].id;
    } else {
      const { prompts, error: promptsError } = await getTodayPrompts();
      if (promptsError) {
        addLog("createPost", { error: promptsError });
        return;
      }
      if (!prompts || prompts.length === 0) {
        addLog("createPost", {
          error:
            "No prompts for today. Insert prompts in the DB and try again.",
        });
        return;
      }
      promptId = prompts[0].id;
      setTodayPromptsState(prompts);
    }

    // 1) Upload image
    const uploadResult = await uploadPostImage({ file });
    addLog("uploadPostImage", uploadResult);
    if (uploadResult.error || !uploadResult.path) {
      return;
    }

    // 2) Create post row using uploaded path
    const { post, error } = await createPost({
      promptId,
      imagePath: uploadResult.path,
      caption: "Test caption from DbHelpersTestPage",
    });
    addLog("createPost", { post, error });
  }

  async function handleGetGlobalFeed() {
    const { posts, error } = await getGlobalFeed({ limit: 10 });
    setLastFeedPosts(posts || []);
    if (posts && posts.length > 0) {
      setTargetPostId(String(posts[0].id)); // default to the newest post
    }
    addLog("getGlobalFeed", { posts, error });
  }

  // 4) REACTIONS & COMMENTS TESTS ------------------------------------------

  function parseTargetPostId() {
    const n = parseInt(targetPostId, 10);
    if (isNaN(n)) return null;
    return n;
  }

  async function handleLikePost() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("likePost", { error: "Invalid postId. Set a valid Post ID first." });
      return;
    }
    const { reaction, error } = await likePost({ postId: pid });
    addLog("likePost", { reaction, error });
  }

  async function handleUnlikePost() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("unlikePost", { error: "Invalid postId. Set a valid Post ID first." });
      return;
    }
    const { success, error } = await unlikePost({ postId: pid });
    addLog("unlikePost", { success, error });
  }

  async function handleHasUserLikedPost() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("hasUserLikedPost", {
        error: "Invalid postId. Set a valid Post ID first.",
      });
      return;
    }
    const { hasLiked, reaction, error } = await hasUserLikedPost({
      postId: pid,
    });
    addLog("hasUserLikedPost", { hasLiked, reaction, error });
  }

  async function handleGetPostLikes() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("getPostLikes", {
        error: "Invalid postId. Set a valid Post ID first.",
      });
      return;
    }
    const { count, reactions, error } = await getPostLikes({
      postId: pid,
      withUsers: true,
    });
    addLog("getPostLikes", { count, reactions, error });
  }

  async function handleAddComment() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("addComment", {
        error: "Invalid postId. Set a valid Post ID first.",
      });
      return;
    }
    if (!commentText.trim()) {
      addLog("addComment", { error: "Comment text is empty." });
      return;
    }
    const { comment, error } = await addComment({
      postId: pid,
      body: commentText.trim(),
    });
    addLog("addComment", { comment, error });
  }

  async function handleGetCommentsForPost() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("getCommentsForPost", {
        error: "Invalid postId. Set a valid Post ID first.",
      });
      return;
    }
    const { comments, error } = await getCommentsForPost({ postId: pid });
    addLog("getCommentsForPost", { comments, error });
  }

  async function handleDeleteFirstComment() {
    const pid = parseTargetPostId();
    if (!pid) {
      addLog("deleteComment", {
        error: "Invalid postId. Set a valid Post ID first.",
      });
      return;
    }
    const { comments, error: fetchError } = await getCommentsForPost({
      postId: pid,
    });
    if (fetchError) {
      addLog("deleteComment", { error: fetchError });
      return;
    }
    if (!comments || comments.length === 0) {
      addLog("deleteComment", {
        error: "No comments to delete for this post.",
      });
      return;
    }
    const firstComment = comments[0];
    const { success, error } = await deleteComment({
      commentId: firstComment.id,
    });
    addLog("deleteComment (first comment)", { success, error, firstComment });
  }

  // ===== Avatar / Profile Picture Tests =====

  function handleAvatarFileChange(e) {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
    if (file) {
      addLog("avatarFileSelected", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
    } else {
      addLog("avatarFileSelected", {
        error: "No file selected",
      });
    }
  }

  async function handleUploadAvatarImage() {
    if (!avatarFile) {
      addLog("uploadAvatarImage", {
        error: "No avatar file selected. Please choose an image first.",
      });
      return;
    }

    const { path, profile, error } = await uploadAvatarImage({ file: avatarFile });

    addLog("uploadAvatarImage", {
      path,
      profile,
      error,
    });

    if (!error && path) {
      const publicUrl = getAvatarPublicUrl(path);
      addLog("uploadAvatarImage_publicUrl", {
        publicUrl,
      });
    }
  }

  async function handleGetProfileWithAvatar() {
    const { profile, error } = await getCurrentUserProfile();

    let avatarPublicUrl = null;
    if (profile?.avatar_url) {
      avatarPublicUrl = getAvatarPublicUrl(profile.avatar_url);
    }

    addLog("getCurrentUserProfile_withAvatar", {
      profile,
      avatarPublicUrl,
      error,
    });
  }


  // ------------------------------------------------------------------------

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h1>dbHelpers Smoke Test</h1>

      {/* AUTH & PROFILES --------------------------------------------------- */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Auth & Profiles</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <label>
            Test Email:{" "}
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </label>
          <label>
            Password:{" "}
            <input
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <label>
            Display Name:{" "}
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            Bio:{" "}
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
        </div>
        <button onClick={handleSignUp}>Sign Up (Email/Password)</button>{" "}
        <button onClick={handleSignIn}>Sign In</button>{" "}
        <button onClick={handleSignOut}>Sign Out</button>{" "}
        <button onClick={handleGetCurrentUser}>Get Current User</button>{" "}
        <button onClick={handleGetCurrentUserProfile}>
          Get Current User Profile
        </button>{" "}
        <button onClick={handleUpdateProfile}>Update Profile</button>
      </section>

      {/* PROMPTS ----------------------------------------------------------- */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Prompts & Daily Prompt</h2>
        <p style={{ maxWidth: "600px" }}>
          Make sure you have at least one row in <code>public.prompts</code>{" "}
          where <code>active_on</code> is today. Then:
        </p>
        <button onClick={handleGetTodayPrompts}>Get Today's Prompts</button>{" "}
        <button onClick={handleSetTodayPromptFromFirst}>
          Set Today's Prompt (use first prompt)
        </button>{" "}
        <button onClick={handleGetUserPromptForToday}>
          Get User's Prompt For Today
        </button>
      </section>

      {/* POSTS & FEED ------------------------------------------------------ */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Posts & Global Feed</h2>
        <p style={{ maxWidth: "600px" }}>
          Select an image file to test upload + createPost. Requires a valid
          prompt for today.
        </p>
        <input type="file" accept="image/*" onChange={handleFileChange} />{" "}
        <button onClick={handleUploadImageAndCreatePost}>
          Upload Image & Create Post
        </button>{" "}
        <button onClick={handleGetGlobalFeed}>Get Global Feed (10)</button>
        {lastFeedPosts.length > 0 && (
          <p style={{ marginTop: "0.5rem" }}>
            Latest feed post IDs:{" "}
            {lastFeedPosts.map((p) => p.id).join(", ")} (first one is used by
            default as target Post ID)
          </p>
        )}
      </section>

      {/* REACTIONS & COMMENTS ---------------------------------------------- */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Reactions & Comments</h2>
        <p style={{ maxWidth: "600px" }}>
          Use a valid Post ID from the global feed. You can click
          &quot;Get Global Feed&quot; above and copy an ID from the log, or
          rely on the first post being set automatically.
        </p>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Target Post ID:{" "}
            <input
              type="text"
              value={targetPostId}
              onChange={(e) => setTargetPostId(e.target.value)}
              style={{ width: "120px" }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <button onClick={handleLikePost}>Like Post</button>{" "}
          <button onClick={handleUnlikePost}>Unlike Post</button>{" "}
          <button onClick={handleHasUserLikedPost}>
            Has User Liked This Post?
          </button>{" "}
          <button onClick={handleGetPostLikes}>Get Post Likes</button>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            New Comment:{" "}
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              style={{ width: "300px" }}
            />
          </label>{" "}
          <button onClick={handleAddComment}>Add Comment</button>{" "}
          <button onClick={handleGetCommentsForPost}>
            Get Comments For Post
          </button>{" "}
          <button onClick={handleDeleteFirstComment}>
            Delete First Comment (for this post)
          </button>
        </div>
      </section>

      {/* AVATAR UPLOAD TESTS ---------------------------------------------- */}
      <section
        style={{
          border: "1px solid #ccc",
          padding: "1rem",
          marginTop: "1rem",
        }}
      >
        <h2>Avatar / Profile Picture Tests</h2>
        <p>
          1) Log in with a test user. 2) Choose an image file. 3) Upload avatar. 4)
          Get profile to verify avatar URL.
        </p>

        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Avatar image:
            <input type="file" accept="image/*" onChange={handleAvatarFileChange} />
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={handleUploadAvatarImage}>
            Upload Avatar Image
          </button>
          <button onClick={handleGetProfileWithAvatar}>
            Get Current Profile (with avatar)
          </button>
        </div>
      </section>

      {/* LOG --------------------------------------------------------------- */}
      <section>
        <h2>Log</h2>
        <p>Newest entries at the bottom.</p>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "0.5rem",
            maxHeight: "300px",
            overflow: "auto",
            background: "#111",
            color: "#0f0",
            fontFamily: "monospace",
            fontSize: "0.8rem",
          }}
        >
          {log.map((entry, idx) => (
            <div key={idx} style={{ marginBottom: "0.5rem" }}>
              <div>
                [{entry.timestamp}] <strong>{entry.label}</strong>
              </div>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
        
    </div>
  );
}

export default DbHelpersTestPage;
