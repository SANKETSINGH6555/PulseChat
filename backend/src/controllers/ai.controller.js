// src/controllers/ai.controller.js

export const generateSmartReplies = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({ replies: [] });
    }

    const text = message.toLowerCase();
    let replies = [];

    if (text.includes("hello") || text.includes("hi")) {
      replies = ["Hi!", "Hey 👋", "Hello 🙂"];
    } 
    else if (text.includes("how are")) {
      replies = ["I'm good!", "Doing fine 😄", "All good 👍"];
    }
    else if (text.includes("bye")) {
      replies = ["Bye!", "See you 👋", "Take care"];
    }
    else if (text.includes("thanks")) {
      replies = ["You're welcome!", "Anytime 🙂", "No problem"];
    }
    else {
      replies = ["Okay 👍", "Got it", "Hmm 🤔"];
    }

    res.json({ replies });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ replies: [] });
  }
};
