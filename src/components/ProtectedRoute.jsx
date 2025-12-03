import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import supabase from "../supabaseClient";

export default function ProtectedRoute({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session);
      setIsLoading(false);
    }
    loadSession();
  }, []);

  if (isLoading) {
    return null; // or a loading spinner if you want
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
}