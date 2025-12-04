// // Uncomment the following lines to use the DbHelpersTestPage instead of LoginPage
// /*
// import DbHelpersTestPage from "./dev/DbHelpersTestPage";

// export default function App() {
//   return <DbHelpersTestPage />;
// }
// */
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import FeedPage from "./components/FeedPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter basename="/Skill-Roulette">
      <Routes>
        {/* Public route */}
        <Route path="/" element={<LoginPage />} />

        {/* Protected route */}
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <FeedPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
