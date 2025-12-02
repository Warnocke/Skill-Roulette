import React from "react";
import Post from "./Post";
import "./../styles/feed.css";

const Feed = () => {
  return (
    <div className="feed-container">
      <div className="feed-header">
        <h2>Home</h2>
      </div>

      {/* Example posts */}
      <Post
        username="ely"
        tag="@ely"
        content="Learned how to write Hello in Spanish!"
      />
      <Post
        username="evan"
        tag="@ytka"
        content="Mind if a white boy speak a little Espanol?"
      />
    </div>
  );
};

export default Feed;
