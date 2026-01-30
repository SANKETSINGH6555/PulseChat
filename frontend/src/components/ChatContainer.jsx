import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import { socket } from "../main";
import { axiosInstance } from "../lib/axios";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    sendMessage,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [isTyping, setIsTyping] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [aiReplies, setAiReplies] = useState([]);

  /* =========================
     LOAD MESSAGES + SOCKETS
  ========================= */
  useEffect(() => {
    if (!selectedUser) return;

    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser]);

  /* =========================
     TYPING INDICATOR
  ========================= */
  useEffect(() => {
    socket.on("userTyping", setIsTyping);
    return () => socket.off("userTyping", setIsTyping);
  }, []);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================
     AI SMART REPLIES (GEMINI)
  ========================= */
  useEffect(() => {
    if (!messages.length || !selectedUser) return;

    const lastMsg = messages[messages.length - 1];

    // only for received messages
    if (lastMsg.senderId === authUser._id || !lastMsg.text) {
      setAiReplies([]);
      return;
    }

    const fetchAiReplies = async () => {
      try {
        const res = await axiosInstance.post("/ai/reply", {
          message: lastMsg.text,
        });

        setAiReplies(res.data.replies || []);
      } catch (err) {
        console.error("AI reply error:", err);
        setAiReplies([]);
      }
    };

    fetchAiReplies();
  }, [messages, authUser, selectedUser]);

  const sendAiReply = async (text) => {
    await sendMessage({ text });
    setAiReplies([]);
  };

  /* =========================
     EDIT / DELETE
  ========================= */
  const handleEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.text);
  };

  const saveEdit = async (id) => {
    try {
      await axiosInstance.put(`/messages/edit/${id}`, { text: editText });
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Edit failed", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/messages/delete/${id}`);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  /* =========================
     REACTIONS
  ========================= */
  const handleReact = async (messageId, emoji) => {
    try {
      await axiosInstance.post(`/messages/react/${messageId}`, { emoji });
    } catch (err) {
      console.error("Reaction failed", err);
    }
  };

  return (
    <>
      <ChatHeader />

      {isTyping && (
        <p className="text-gray-400 text-sm px-6 animate-pulse">
          User is typing...
        </p>
      )}

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`chat ${
                  msg.senderId === authUser._id ? "chat-end" : "chat-start"
                }`}
              >
                <div
                  className={`chat-bubble shadow-lg ${
                    msg.senderId === authUser._id
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                      : "bg-gradient-to-r from-slate-700 to-slate-900 text-slate-200"
                  }`}
                >
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Shared"
                      className="rounded-lg h-48 object-cover"
                    />
                  )}

                  {editingId === msg._id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="bg-black/30 px-2 py-1 rounded text-sm w-full"
                      />
                      <button onClick={() => saveEdit(msg._id)}>✔</button>
                      <button onClick={() => setEditingId(null)}>✖</button>
                    </div>
                  ) : (
                    msg.text && <p className="mt-2">{msg.text}</p>
                  )}

                  {msg.senderId === authUser._id && (
                    <div className="flex gap-3 mt-1 text-xs opacity-70">
                      <button onClick={() => handleEdit(msg)}>Edit</button>
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className="text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {msg.reactions?.length > 0 && (
                    <div className="flex gap-2 mt-1 text-sm">
                      {msg.reactions.map((r, i) => (
                        <span key={i}>{r.emoji}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-1 text-sm">
                    {["❤️", "😂", "👍", "🔥"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg._id, emoji)}
                        className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs mt-1 opacity-75 flex gap-2">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {msg.senderId === authUser._id && (
                      <span>{msg.isRead ? "✓✓ Seen" : "✓ Sent"}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser?.fullName} />
        )}
      </div>

      {/* 🤖 AI SMART REPLIES */}
      {aiReplies.length > 0 && (
        <div className="max-w-3xl mx-auto mb-3 flex gap-2 flex-wrap px-6">
          {aiReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => sendAiReply(reply)}
              className="px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm shadow-md hover:scale-105 transition"
            >
              🤖 {reply}
            </button>
          ))}
        </div>
      )}

      <MessageInput />
    </>
  );
}

export default ChatContainer;
