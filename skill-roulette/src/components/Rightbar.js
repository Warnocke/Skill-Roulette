import React from "react";

const RightBar = () => {
  return (
    <div className="rightbar">
      <div className="search-box">
        <input type="text" placeholder="Search…" />
      </div>

      <div className="trending-box">
        <h3>Trending</h3>
        <p>#React</p>
        <p>#SkillRoulette</p>
        <p>#WomenInTech</p>
      </div>
    </div>
  );
};

export default RightBar;
