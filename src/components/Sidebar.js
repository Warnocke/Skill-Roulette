import React from "react";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h1 className="logo">SR</h1>

      <nav>
        <a className="nav-item">Home</a>
        <a className="nav-item">Explore</a>
        <a className="nav-item">Messages</a>
        <a className="nav-item">Profile</a>
      </nav>

      <button className="post-btn">Post</button>
    </div>
  );
};

export default Sidebar;
