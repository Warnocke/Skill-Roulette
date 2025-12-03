// src/components/Post.js
import React from "react";
import "./../styles/post.css";

const Post = ({ username, tag, content, image }) => {
  return (
    <div className="post">
      <div className="post-header">
        <div className="post-user">
          <strong>{username}</strong> <span className="tag">{tag}</span>
        </div>
      </div>
      <div className="post-content">
        <p>{content}</p>
        {image && <img src={image} alt="post" className="post-image" />}
      </div>
    </div>
  );
};

export default Post;
