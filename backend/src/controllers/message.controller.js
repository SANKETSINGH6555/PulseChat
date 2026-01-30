import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

/* =========================
   GET ALL CONTACTS
========================= */
export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const users = await User.find({ _id: { $ne: loggedInUserId } }).select(
      "-password"
    );

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET MESSAGES + READ RECEIPTS
========================= */
export const getMessagesByUserId = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: myId,
        isRead: false,
      },
      { isRead: true }
    );

    const senderSocketId = getReceiverSocketId(otherUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", {
        receiverId: myId,
      });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessagesByUserId:", error);
    res.status(500).json({ message: "Failed to load messages" });
  }
};

/* =========================
   SEND MESSAGE
========================= */
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({
        message: "Text or image is required.",
      });
    }

    if (senderId.equals(receiverId)) {
      return res.status(400).json({
        message: "Cannot send messages to yourself.",
      });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({
        message: "Receiver not found.",
      });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      isRead: false,
      reactions: [],
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* =========================
   GET CHAT PARTNERS
========================= */
export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId },
        { receiverId: loggedInUserId },
      ],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* =========================
   REACT TO MESSAGE (FEATURE 5)
========================= */
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const existingReaction = message.reactions.find(
      (r) => r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
      existingReaction.emoji = emoji;
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReaction", message);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReaction", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error reacting to message:", error);
    res.status(500).json({ message: "Failed to react" });
  }
};

/* =========================
   EDIT MESSAGE
========================= */
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);

    if (receiverSocketId)
      io.to(receiverSocketId).emit("messageEdited", message);
    if (senderSocketId)
      io.to(senderSocketId).emit("messageEdited", message);

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: "Edit failed" });
  }
};

/* =========================
   DELETE MESSAGE
========================= */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await message.deleteOne();

    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);

    if (receiverSocketId)
      io.to(receiverSocketId).emit("messageDeleted", messageId);
    if (senderSocketId)
      io.to(senderSocketId).emit("messageDeleted", messageId);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};

