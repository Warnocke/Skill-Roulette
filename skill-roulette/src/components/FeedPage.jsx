import React from "react";

export default function FeedPage() {
  const posts = [
    { id: 1, text: "Welcome to Skill Roulette 🎉" },
    { id: 2, text: "Your first recommended skill: React" },
    { id: 3, text: "Try connecting with another learner!" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Your Feed</h1>
      <div style={{ marginTop: "1.5rem" }}>
        {posts.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#f3f3f3",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            {p.text}
          </div>
        ))}
      </div>
    </div>
  );
}
