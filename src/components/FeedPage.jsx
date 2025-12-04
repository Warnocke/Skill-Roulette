import React, { useEffect, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useAuth } from "../contexts/Auth";
import { getDailyPrompt } from "../helper/getDailyPrompt";
import '../styles/feed.css';
import '../styles/post.css';

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
              <div key={post.id} className="post">

                {/* Header */}
                <div className="post-header">
                  <img
                    src={post.profiles?.avatar_url || "https://placehold.co/40"}
                    alt="avatar"
                    className="post-avatar"
                  />
                  <div className="post-user-info">
                    <p>{post.profiles?.display_name || "unknown_user"}</p>
                    <p className="post-time">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Caption */}
                <div className="post-content">
                  {post.caption && <p>{post.caption}</p>}
                </div>

                {/* Image */}
                {post.image_url && (
                  <img
                    src={post.image_url}
                    className="post-image"
                    alt="proof"
                  />
                )}

                {/* ⭐ LIKE BUTTON (working) */}
                <div className="like-section">
                  <button
                    className="like-button"
                    onClick={() => toggleLike(post)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: post.user_liked ? "red" : "gray",
                      fontSize: "20px",
                      marginTop: "8px"
                    }}
                  >
                    {post.user_liked ? "❤️" : "🤍"} {post.likes_count}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}