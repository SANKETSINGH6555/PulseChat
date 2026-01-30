import { useRef, useState, useEffect } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";
import { socket } from "../main";
import { useChatStore } from "../store/useChatStore";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const fileInputRef = useRef(null);

  const { sendMessage, isSoundEnabled, selectedUser } = useChatStore();

  /* =========================
     AI SMART REPLY AUTO-FILL
  ========================= */
  useEffect(() => {
    const handler = (e) => {
      setText(e.detail);
    };

    document.addEventListener("fillMessage", handler);
    return () => document.removeEventListener("fillMessage", handler);
  }, []);

  /* =========================
     SEND MESSAGE
  ========================= */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendMessage({
      text: text.trim(),
      image: imagePreview,
    });

    if (selectedUser?._id) {
      socket.emit("stopTyping", selectedUser._id);
    }

    setText("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* =========================
     IMAGE HANDLING
  ========================= */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file?.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-slate-700/50 bg-slate-900/40 backdrop-blur">
      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700 shadow"
            />
            <button
              onClick={removeImage}
              type="button"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full
                         bg-slate-800 flex items-center justify-center
                         text-slate-200 hover:bg-red-500 transition"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* INPUT FORM */}
      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-3"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            isSoundEnabled && playRandomKeyStrokeSound();

            if (selectedUser?._id) {
              socket.emit("typing", selectedUser._id);
              setTimeout(() => {
                socket.emit("stopTyping", selectedUser._id);
              }, 1200);
            }
          }}
          className="flex-1 bg-slate-800/70 border border-slate-700/50
                     rounded-lg py-2 px-4 text-slate-200
                     focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Type your message..."
        />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-lg px-4 transition-colors
            bg-slate-800/60 hover:bg-slate-700
            ${imagePreview ? "text-cyan-400" : "text-slate-400"}`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="bg-gradient-to-r from-cyan-500 to-blue-600
                     text-white rounded-lg px-4 py-2
                     font-medium hover:scale-105 transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
