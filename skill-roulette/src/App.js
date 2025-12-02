// import React from "react";
// import LoginPage from "./components/LoginPage";
// export default function App() {
//   return <LoginPage />;
// }


// // Uncomment the following lines to use the DbHelpersTestPage instead of LoginPage
// /*
// import DbHelpersTestPage from "./dev/DbHelpersTestPage";

// export default function App() {
// return <DbHelpersTestPage />;
// }
// */
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import FeedPage from "./components/FeedPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/feed" element={<FeedPage />} />
      </Routes>
    </Router>
  );
}
