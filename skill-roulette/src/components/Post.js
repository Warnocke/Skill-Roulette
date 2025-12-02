import React from "react";

const Post = ({ username, tag, content }) => {
  return (
    <div className="post-card">
      <div className="post-avatar">
        <img src="https://via.placeholder.com/48" alt="avatar" />
      </div>

      <div className="post-content">
        <div className="post-header">
          <span className="post-username">{username}</span>
          <span className="post-tag">{tag}</span>
        </div>

        <p className="post-text">{content}</p>

        <div className="post-actions">
          <button>💬</button>
          <button>🔁</button>
          <button>❤️</button>
        </div>
      </div>
    </div>
  );
};

export default Post;
