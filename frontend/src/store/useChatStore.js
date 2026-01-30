import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { socket } from "../main";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  /* =========================
     UI CONTROLS
  ========================= */
  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  /* =========================
     CONTACTS / CHATS
  ========================= */
  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  /* =========================
     MESSAGES
  ========================= */
  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isRead: false,
      isEdited: false,
      reactions: [],
      isOptimistic: true,
    };

    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: messages.concat(res.data) });
    } catch (error) {
      set({ messages });
      toast.error(error.response?.data?.message || "Message failed");
    }
  },

  /* =========================
     SOCKET SUBSCRIPTIONS
  ========================= */
  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    // 📨 New message
    socket.on("newMessage", (newMessage) => {
      if (newMessage.senderId !== selectedUser._id) return;

      set({ messages: [...get().messages, newMessage] });

      if (isSoundEnabled) {
        const audio = new Audio("/sounds/notification.mp3");
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    });

    // 👀 Read receipts
    socket.on("messagesSeen", ({ receiverId }) => {
      set({
        messages: get().messages.map((msg) =>
          msg.senderId === receiverId ? { ...msg, isRead: true } : msg
        ),
      });
    });

    // ❤️ Reactions
    socket.on("messageReaction", (updatedMessage) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        ),
      });
    });

    // ✏️ Edited message
    socket.on("messageEdited", (updatedMessage) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        ),
      });
    });

    // 🗑 Deleted message
    socket.on("messageDeleted", (messageId) => {
      set({
        messages: get().messages.filter((msg) => msg._id !== messageId),
      });
    });
  },

  unsubscribeFromMessages: () => {
    socket.off("newMessage");
    socket.off("messagesSeen");
    socket.off("messageReaction");
    socket.off("messageEdited");
    socket.off("messageDeleted");
  },
}));
