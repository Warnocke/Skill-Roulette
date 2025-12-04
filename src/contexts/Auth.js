import React, { createContext, useContext, useState, useEffect } from "react";
// FIX: Adjusted the relative path to look one directory higher, which sometimes resolves module compilation errors in nested structures.
import supabase from "../supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Introduce loading state to indicate if initial session check is complete
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial check: get the current session immediately
    // Note: The getSession() method is synchronous here, but we rely on onAuthStateChange for reactivity.
    const getInitialSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }
        setLoading(false); // Initial load complete
    };
    getInitialSession();


    // 2. Listen for authentication state changes (login, logout, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Cleanup the listener when the component unmounts
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = (userData) => {
    // This function is mostly a placeholder, as the listener handles state updates after supabase actions.
    setUser(userData);
  };
  
  const logout = async () => {
    // Supabase sign out
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error signing out:", error.message);
    // The onAuthStateChange listener handles setting setUser(null) automatically.
  };

  return (
    // Providing 'loading' state is crucial for components that rely on the user status
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);