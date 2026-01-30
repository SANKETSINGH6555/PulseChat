import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { io } from "socket.io-client";
import App from "./App.jsx";
import "./index.css";

// ✅ Dynamic socket URL based on environment
const SOCKET_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:3000"
    : import.meta.env.VITE_API_URL;

// ✅ SINGLE global socket instance
export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false, // connection will be started after login
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
