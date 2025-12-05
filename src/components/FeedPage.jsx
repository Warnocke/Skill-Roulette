import React, { useEffect, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useAuth } from "../contexts/Auth";
import { getDailyPrompt } from "../helper/getDailyPrompt";
import '../styles/feed.css';
import '../styles/post.css';
import { 
  getCommentsForPost, 
  addComment, 
  deleteComment 
} from "../lib/dbHelpers";


function PostCard({ post, user, onRefresh }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  // Load comments when the user expands the comment section
  async function loadComments() {
    setLoadingComments(true);
    const { comments, error } = await getCommentsForPost({ postId: post.id });
    if (!error) setComments(comments || []);
    setLoadingComments(false);
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;

    const { comment, error } = await addComment({
      postId: post.id,
      body: commentText.trim(),
    });

    if (!error) {
      setCommentText("");
      loadComments(); // refresh
    }
  }

  async function handleDeleteComment(commentId) {
    const { success, error } = await deleteComment({ commentId });
    if (!error) loadComments(); // refresh
  }

  return (
    <div className="post">

      {/* --- POST CONTENT (your existing code) --- */}
      <div className="post-header">
        <img
          src={post.profiles?.avatar_url || "https://placehold.co/40"}
          alt="avatar"
          className="post-avatar"
        />
        <div className="post-user-info">
          <p>{post.profiles?.display_name}</p>
          <p className="post-time">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="post-content">
        {post.caption && <p>{post.caption}</p>}
      </div>

      {post.image_url && (
        <img src={post.image_url} className="post-image" alt="proof" />
      )}

      {/* --- LIKE BUTTON (already implemented) --- */}
      <div className="like-section">
        {/* reuse your toggleLike logic */}
      </div>

      {/* --- COMMENTS SECTION --- */}
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
                      <strong>{c.user?.display_name || "unknown_user"}:</strong> {c.body}
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

            {/* Add a comment */}
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

export default function FeedPage() {
  const { user, loading } = useAuth(); 

  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [postText, setPostText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loadingPost, setLoadingPost] = useState(false);

  
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

    // Transform reaction rows into a usable like system
    const transformed = data.map((post) => {
      const likes_count = post.reactions?.[0]?.count || 0;
      const user_liked = post.user_reaction?.some((r) => r.user_id === user?.id) || false;

      return {
        ...post,
        likes_count,
        user_liked
      };
    });

    setPosts(transformed);
    setLoadingFeed(false);
  }, [user]);

  // Load prompt + feed
  useEffect(() => {
    async function loadInitial() {
      const todayPrompt = await getDailyPrompt();
      setPrompt(todayPrompt);
      setLoadingPrompt(false);
      fetchPosts();
    }
    loadInitial();
  }, [fetchPosts]);


  // Upload image
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


  // Post submission
  async function handleSubmit(e) {
    e.preventDefault();

    if (!postText.trim() || !imageFile) return;
    if (!user) return;

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

  // ⭐ LIKE / UNLIKE using `reactions`
  async function toggleLike(post) {
    if (!user) return;

    if (post.user_liked) {
      // Unlike
      await supabase
        .from("reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);
    } else {
      // Like
      await supabase
        .from("reactions")
        .insert({
          post_id: post.id,
          user_id: user.id,
          type: "like"
        });
    }

    fetchPosts(); // update UI
  }

  // Loading state
  if (loading || loadingPrompt) {
    return <p>Loading...</p>;
  }

  if (!prompt) {
    return <p>Error loading today's prompt.</p>;
  }

  return (
    <div className="feed-container">

      {/* Daily Challenge Header */}
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

      {/* Community Feed */}
      <div className="community-feed">
        <h3 className="feed-title">🌟 Community Feed</h3>

        {loadingFeed ? (
          <p>Loading posts...</p>
        ) : (
          <div className="posts-container">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} user={user} onRefresh={fetchPosts} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}