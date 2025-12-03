import React from "react";
import Feed from "./Feed";
import ProfileButton from "./ProfileButton";

export default function FeedPage() {
  return (
    <div style={{ padding: "2rem", position: "relative" }}>

      <ProfileButton />

      <Feed />
    </div>
  );
}
