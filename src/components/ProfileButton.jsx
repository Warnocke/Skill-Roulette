import React from "react";
import { useNavigate } from "react-router-dom";

const ProfileButton = () => {
  const navigate = useNavigate();

  const email = localStorage.getItem("userEmail") || "";

  const handleClick = () => {
    navigate("/profile");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        margin: "0.75rem 0.75rem 0 0",
        padding: "0.5rem 1rem",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        fontWeight: 500,
        backgroundColor: "#162938",
        color: "#ffffff",
        zIndex: 1000,
      }}
    >
      {email ? `My Profile (${email})` : "My Profile"}
    </button>
  );
};

export default ProfileButton;
