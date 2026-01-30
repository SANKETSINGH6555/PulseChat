import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { io } from "socket.io-client";

// ✅ SINGLE global socket (ONLY ONE)
export const socket = io("http://localhost:3000", {
  withCredentials: true,
  autoConnect: false, // important
});

function Root() {
  return (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
