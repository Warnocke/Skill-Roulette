import React, { useEffect, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useAuth } from "../contexts/Auth";
import { getDailyPrompt } from "../helper/getDailyPrompt";
import '../styles/feed.css';
import '../styles/post.css';

export default function FeedPage() {
  // Using user and loading state from the Auth Context
  const { user, loading } = useAuth(); 

  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  
  // State for posts and loading
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Post Submission Form State
  const [postText, setPostText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loadingPost, setLoadingPost] = useState(false);

  // --- Core Feed Fetching Logic ---
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
      profiles!user_id ( display_name, avatar_url )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching feed posts:", error);
  } else {
    setPosts(data || []);
  }
  setLoadingFeed(false);
}, []);


  // --- Initial Data Load (Prompt and Feed) ---
  useEffect(() => {
    async function loadInitialData() {
      // 1. Load Prompt
      const result = await getDailyPrompt(); 
      setPrompt(result);
      setLoadingPrompt(false);

      // 2. Load Feed
      fetchPosts();
    }

    loadInitialData();
  }, [fetchPosts]);

  // --- Post Submission Handlers ---

  // Upload image to Supabase Storage
  async function uploadImage(file) {
    if (!user) {
        console.error("Authentication required for image upload.");
        return null;
    }
      
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`; // Use user ID for organization

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Image upload error:", uploadError.message);
      // Using custom message box instead of alert
      const messageContainer = document.getElementById('post-message');
      if (messageContainer) {
          messageContainer.textContent = `Image upload failed: ${uploadError.message}. Check storage permissions.`;
          setTimeout(() => messageContainer.textContent = "", 5000);
      }
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  // Handle post submission
  async function ensureUserProfile(userId) {
    // Check if profile exists - fix the query structure
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();  // Use maybeSingle() instead of single()
  
    if (checkError) {
      console.error('Error checking profile:', checkError);
      return false;
    }
  
    if (!existingProfile) {
      // Get a better display name from the user object
      const displayName = user?.email?.split('@')[0] || user?.user_metadata?.name || 'Skill Roulette User';
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: displayName,  // Use email username or metadata name
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
  
      if (profileError) {
        console.error('Error creating profile:', profileError);
        return false;
      }
    }
    return true;
  }

async function handleSubmit(e) {
  e.preventDefault();
  if (!user) {
    console.error("You must be logged in to post.");
    return;
  }

  if (!prompt || !prompt.id) {
    console.error("Prompt not loaded, cannot submit post.");
    return;
  }

  if (!postText.trim() || !imageFile) {
    const messageContainer = document.getElementById('post-message');
    if (messageContainer) {
      messageContainer.textContent = "Please provide both text and an image.";
      setTimeout(() => messageContainer.textContent = "", 3000);
    }
    return;
  }

  setLoadingPost(true);

  // Ensure user profile exists
  const profileExists = await ensureUserProfile(user.id);
  if (!profileExists) {
    const messageContainer = document.getElementById('post-message');
    if (messageContainer) {
      messageContainer.textContent = "Error creating user profile. Please try again.";
      setTimeout(() => messageContainer.textContent = "", 5000);
    }
    setLoadingPost(false);
    return;
  }

  let imageUrl = null;
  if (imageFile) {
    imageUrl = await uploadImage(imageFile);
    if (!imageUrl) {
      setLoadingPost(false);
      return;
    }
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    prompt_id: prompt.id,
    caption: postText.trim(),
    image_url: imageUrl,
  });

  if (error) {
    console.error("Post insert error:", error);
    const messageContainer = document.getElementById('post-message');
    if (messageContainer) {
      messageContainer.textContent = `Post failed: ${error.message}`;
      setTimeout(() => messageContainer.textContent = "", 5000);
    }
  } else {
    setPostText("");
    setImageFile(null);

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
    fetchPosts();
  }

  setLoadingPost(false);
}


  // --- Like/Unlike Handler (unchanged) ---
  const handleLikeToggle = async (postId, userLiked) => {
    if (!user) {
      console.error("You must be logged in to like posts.");
      return;
    }

    if (userLiked) {
      // Unlike: Delete the existing like record
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      
      if (error) console.error("Error deleting like:", error);
    } else {
      // Like: Insert a new like record
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: user.id
        });

      if (error) console.error("Error inserting like:", error);
    }

    // Refresh the feed to show updated counts
    fetchPosts(); 
  };


  // --- Inline SVG Components (unchanged) ---

  const TargetIcon = ({ className = "w-6 h-6 text-indigo-500 mr-2" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );

  const FeatherIcon = ({ className = "w-6 h-6 text-green-500 mr-2" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 17h3a5 5 0 0 0 5-5v-1a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h3" />
      <path d="M9 18V6l10 5-10 7z" />
    </svg>
  );

  const UserIcon = ({ className = "w-3 h-3 mr-1 text-indigo-500" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const ClockIcon = ({ className = "w-3 h-3 mr-1" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  const MessageIcon = ({ className = "w-4 h-4 mr-1" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  const HeartIcon = ({ filled = false, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );

  // --- Render Logic ---

  if (loading || loadingPrompt) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-xl text-indigo-600 animate-pulse">Checking session and loading challenge...</p>
      </div>
    );
  }
  
  if (!prompt) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-red-50">
        <p className="text-xl text-red-700">Failed to load prompt. Please check the `getDailyPrompt` logic.</p>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Today's Challenge Header */}
      <div className="feed-header">
        <div className="challenge-card">
          <div className="challenge-icon">🎯</div>
          <h2>Today's Universal Challenge</h2>
          <p className="challenge-text">{prompt.prompt_text}</p>
        </div>
      </div>
  
      {/* Create a Post Form */}
      <div className="new-post-card">
        <h3 className="post-form-title">
          <span className="form-icon">✨</span>
          Share Your Proof
        </h3>
        
        {user ? (
          <form onSubmit={handleSubmit} className="new-post-form">
            <textarea
              placeholder="What did you learn or create? Add a description to your proof."
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows="3"
            />
            
            <div className="file-input-container">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="file-input"
              />
            </div>
  
            {imageFile && (
              <p className="file-selected">📷 File selected: {imageFile.name}</p>
            )}
            
            <div id="post-message" className="post-message"></div>
  
            <button 
              type="submit" 
              disabled={loadingPost || !postText.trim() || !imageFile}
              className={`submit-btn ${loadingPost || !postText.trim() || !imageFile ? 'disabled' : ''}`}
            >
              {loadingPost ? 'Posting...' : 'Post Completion to Feed'}
            </button>
          </form>
        ) : (
          <p className="login-message">You must log in to post your completion.</p>
        )}
      </div>
  
      {/* Community Feed */}
      <div className="community-feed">
        <h3 className="feed-title">🌟 Community Feed</h3>
        
        {loadingFeed ? (
          <div className="loading-message">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="empty-feed">No posts yet. Be the first to conquer today's challenge! 🚀</div>
        ) : (
          <div className="posts-container">
            {posts.map((post) => (
              <div key={post.id} className="post">
                <div className="post-header">
                  <img 
                    src={post.profiles?.avatar_url || 'https://placehold.co/40x40/9ca3af/ffffff?text=U'} 
                    alt="Avatar"
                    className="post-avatar"
                  />
                  <div className="post-user-info">
                    <p className="post-user">{post.profiles?.display_name || "unknown_user"}</p>
                    <p className="post-time">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="post-content">
                  {post.caption && <p>{post.caption}</p>}
                </div>
  
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={`Proof for prompt: ${post.prompt_id}`}
                    className="post-image"
                    onError={(e) => { 
                      e.target.onerror = null; 
                      e.target.src = 'https://placehold.co/600x400/ef4444/ffffff?text=Image+Failed'; 
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}