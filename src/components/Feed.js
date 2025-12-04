import React, { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function Feed({ dailyPrompt }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        content,
        image_url,
        prompt_id,
        created_at,
        profiles ( username )
      `
      )
      .order("created_at", { ascending: false });

    if (!error) setPosts(data);
  }

  async function uploadImage(file) {
    if (!file) return null;

    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("post_images")
      .upload(fileName, file);

    if (error) {
      console.error("Image upload failed:", error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post_images").getPublicUrl(fileName);

    return publicUrl;
  }

  async function handlePostSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let imageUrl = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const user = supabase.auth.getUser
      ? (await supabase.auth.getUser()).data.user
      : supabase.auth.user();

    if (!user) {
      alert("You must be logged in to post.");
      setLoading(false);
      return;
    }

    const { prompt_id } = dailyPrompt;

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: newPost,
      image_url: imageUrl,
      prompt_id: prompt_id, // REQUIRED to fix your not-null error
    });

    if (error) {
      console.error("Post error:", error);
      setLoading(false);
      return;
    }

    setNewPost("");
    setImageFile(null);
    fetchPosts();
    setLoading(false);
  }

  return (
    <div className="feed-container">
      {/* Post form */}
      <form onSubmit={handlePostSubmit} className="create-post-box">
        <textarea
          placeholder="Share your thoughts..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          required
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />

        <button disabled={loading} type="submit">
          {loading ? "Posting..." : "Post"}
        </button>
      </form>

      {/* Posts */}
      <div className="posts-list">
        {posts.length === 0 && <p>No posts yet. Be the first!</p>}

        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <p className="post-user">@{post.profiles?.username || "unknown"}</p>
            <p className="post-content">{post.content}</p>

            {post.image_url && (
              <img src={post.image_url} alt="post" className="post-image" />
            )}

            <p className="post-date">
              {new Date(post.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
