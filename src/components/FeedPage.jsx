import React, { useEffect, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useAuth } from "../contexts/Auth";
import { getDailyPrompt } from "../helper/getDailyPrompt";

import Logo from "./Logo";
import ProfileButton from "./ProfileButton";

import '../styles/feed.css';
import '../styles/post.css';

import { 
  getCommentsForPost, 
  addComment, 
  deleteComment 
} from "../lib/dbHelpers";

/* -----------------------------------------------------------
   POST CARD COMPONENT
----------------------------------------------------------- */
function PostCard({ post, user, onRefresh, onLike, promptMap }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  // Load comments
  async function loadComments() {
    setLoadingComments(true);
    const { comments, error } = await getCommentsForPost({ postId: post.id });
    if (!error) setComments(comments || []);
    setLoadingComments(false);
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;

    const { error } = await addComment({
      postId: post.id,
      body: commentText.trim(),
    });

    if (!error) {
      setCommentText("");
      loadComments();
    }
  }

  async function handleDeleteComment(commentId) {
    const { error } = await deleteComment({ commentId });
    if (!error) loadComments();
  }

  return (
    <div className="post">
      {/* POST HEADER */}
      <div className="post-header">
        <img
          src={post.profiles?.avatar_url || "https://placehold.co/40"}
          alt="avatar"
          className="post-avatar"
        />
        <div className="post-user-info">
          <p>{post.profiles?.display_name || "unknown_user"}</p>
          <p className="post-time">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      </div>

      {/* POST BODY */}
      <div className="post-content">
        {post.caption && <p>{post.caption}</p>}

        {/* PROMPT */}
        {promptMap[post.prompt_id] && (
          <p className="post-prompt">
            <em>Completed: {promptMap[post.prompt_id]}</em>
          </p>
        )}
      </div>

      {/* IMAGE */}
      {post.image_url && (
        <img src={post.image_url} className="post-image" alt="proof" />
      )}

      {/* LIKE BUTTON */}
      <div className="like-section">
        <button
          className="like-button"
          onClick={onLike}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: post.user_liked ? "red" : "gray",
            fontSize: "20px",
            marginTop: "8px",
          }}
        >
          {post.user_liked ? "❤️" : "🤍"} {post.likes_count}
        </button>
      </div>

      {/* COMMENTS */}
      <div className="comments-section">
        <button
          className="show-comments-btn"
          onClick={() => {
            setShowComments(!showComments);
            if (!showComments) loadComments();
          }}
        >
          💬 {showComments ? "Hide" : "Show"} Comments
        </button>

        {showComments && (
          <div className="comments-container">
            {loadingComments ? (
              <p>Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="no-comments">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="comment">
                  <p>
                    <strong>{c.user?.display_name || "unknown_user"}:</strong>{" "}
                    {c.body}
                  </p>

                  {c.user_id === user?.id && (
                    <button
                      className="delete-comment"
                      onClick={() => handleDeleteComment(c.id)}
                    >
                      ✖
                    </button>
                  )}
                </div>
              ))
            )}

            {/* ADD COMMENT */}
            <form onSubmit={handleAddComment} className="comment-form">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit">Post</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   MAIN FEED PAGE
----------------------------------------------------------- */
export default function FeedPage() {
  const { user, loading } = useAuth();

  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);

  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [postText, setPostText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loadingPost, setLoadingPost] = useState(false);

  const [promptMap, setPromptMap] = useState({});

  /* Load all prompts into promptMap (frontend-only) */
  useEffect(() => {
    async function loadPrompts() {
      const { data, error } = await supabase
        .from("prompts")
        .select("id, prompt_text");

      if (!error && data) {
        const map = {};
        data.forEach((p) => (map[p.id] = p.prompt_text));
        setPromptMap(map);
      }
    }

    loadPrompts();
  }, []);

  /* Load feed posts */
  const fetchPosts = useCallback(async () => {
    setLoadingFeed(true);

    const { data, error } = await supabase
      .from("posts")
      .select(`
        id,
        caption,
        image_url,
        prompt_id,
        created_at,
        profiles!user_id ( display_name, avatar_url ),
        reactions:reactions(count),
        user_reaction:reactions(user_id)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Feed fetch error:", error);
      setLoadingFeed(false);
      return;
    }

    const transformed = data.map((post) => {
      const likes_count = post.reactions?.[0]?.count || 0;
      const user_liked =
        post.user_reaction?.some((r) => r.user_id === user?.id) || false;

      return { ...post, likes_count, user_liked };
    });

    setPosts(transformed);
    setLoadingFeed(false);
  }, [user]);

  /* Load today's prompt + feed */
  useEffect(() => {
    async function loadInitial() {
      const todayPrompt = await getDailyPrompt();
      setPrompt(todayPrompt);
      setLoadingPrompt(false);
      fetchPosts();
    }
    loadInitial();
  }, [fetchPosts]);

  /* Upload image */
  async function uploadImage(file) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("post-images")
      .upload(fileName, file);

    if (error) {
      console.error("Image upload failure:", error);
      return null;
    }

    const { data } = supabase.storage
      .from("post-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  /* Create a new post */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!postText.trim() || !imageFile) return;

    setLoadingPost(true);

    const imageUrl = await uploadImage(imageFile);
    if (!imageUrl) {
      setLoadingPost(false);
      return;
    }

    await supabase.from("posts").insert({
      user_id: user.id,
      prompt_id: prompt.id,
      caption: postText.trim(),
      image_url: imageUrl,
    });

    setPostText("");
    setImageFile(null);

    fetchPosts();
    setLoadingPost(false);
  }

  /* Like / Unlike */
  async function toggleLike(post) {
    if (!user) return;

    if (post.user_liked) {
      await supabase
        .from("reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("reactions").insert({
        post_id: post.id,
        user_id: user.id,
        type: "like",
      });
    }

    fetchPosts();
  }

  /* Loading states */
  if (loading || loadingPrompt) return <p>Loading...</p>;
  if (!prompt) return <p>Error loading today's prompt.</p>;

  /* -----------------------------------------------------------
     PAGE UI
----------------------------------------------------------- */
  return (
    <div className="feed-wrapper">

      {/* ⭐ Logo on the top-left */}
      <div className="feed-topbar">
          <Logo variant="feed" />
      </div>

      {/* ⭐ Centered white feed container */}
      <div className="feed-container">

        <ProfileButton />

        {/* Daily Challenge */}
        <div className="feed-header">
          <div className="challenge-card">
            <div className="challenge-icon">🎯</div>
            <h2>Today's Universal Challenge</h2>
            <p className="challenge-text">{prompt.prompt_text}</p>
          </div>
        </div>

        {/* New Post */}
        <div className="new-post-card">
          <h3 className="post-form-title">✨ Share Your Proof</h3>

          <form onSubmit={handleSubmit} className="new-post-form">
            <textarea
              placeholder="Describe your proof..."
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
            />

            <button disabled={!postText.trim() || !imageFile}>
              {loadingPost ? "Posting..." : "Post Completion"}
            </button>
          </form>
        </div>

        {/* Feed */}
        <div className="community-feed">
          <h3 className="feed-title">🌟 Community Feed</h3>

          {loadingFeed ? (
            <p>Loading posts...</p>
          ) : (
            <div className="posts-container">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  onRefresh={fetchPosts}
                  onLike={() => toggleLike(post)}
                  promptMap={promptMap}
                />
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}