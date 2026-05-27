import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AdminApp from "./Admin";

const root = ReactDOM.createRoot(document.getElementById("root"));
const isAdmin = window.location.pathname === "/admin";

root.render(
  <React.StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>
);
