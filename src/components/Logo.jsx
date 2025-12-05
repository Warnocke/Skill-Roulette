import React from 'react';
import srLogo from '../elements/SR_logo.png';
import '../styles/Logo.css';

export default function Logo({ variant = "auth" }) {
  return (
    <div className={`logo-container ${variant === "feed" ? "feed-logo-container" : ""}`}>
      <img src={srLogo} alt="Skill Roulette Logo" className="auth-logo" />
    </div>
  );
}