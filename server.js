// server.js
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ---------- CONFIG (replace with your real values or use env vars) ----------
const MONGO_URI = "mongodb+srv://sekiro:reigen100@cluster0.dwxnugf.mongodb.net/docs";

const BOT_TOKEN = "8207709513:AAHmcYeKb3OXcuO4KpxZSRZAGDVEhoXyAMQ";

const CHAT_ID = "-1003825143216";
// ---------------------------------------------------------------------------

app.use(express.static(".")); // serve index.html / docs.html

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connect error:", err));

// User model
const User = mongoose.model("User", {
  name: String,
  email: String,
  createdAt: { type: Date, default: Date.now }
});

// helper: send telegram message (returns axios response or throws)
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  return axios.post(url, { chat_id: CHAT_ID, text });
}

// POST /register
app.post("/register", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "missing name or email" });

    // avoid duplicate registrations
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({ name, email: email.toLowerCase() });
      await user.save();
      // send Telegram notification (fire-and-wait)
      try {
        await sendTelegram(`New Documentation Visitor\n\nName: ${name}\nEmail: ${email}`);
        console.log("Telegram notification sent");
      } catch (tgErr) {
        console.error("Telegram send error:", tgErr.response ? tgErr.response.data : tgErr.message);
      }
    } else {
      console.log("Existing user registration attempt:", email);
    }

    return res.json({ status: "ok", registered: !user ? true : false });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// GET /count -> unique registered users
app.get("/count", async (req, res) => {
  try {
    const count = await User.countDocuments();
    return res.json({ count });
  } catch (err) {
    console.error("Count error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// Optional admin endpoint to clear users (USE WITH CAUTION).
// You can secure it by checking a secret query param or remove entirely.
// Example: GET /admin/reset?secret=YOUR_SECRET
app.get("/admin/reset", async (req, res) => {
  const secret = req.query.secret;
  const expected = process.env.RESET_SECRET || "CHANGE_THIS_SECRET";
  if (secret !== expected) return res.status(403).send("forbidden");
  await User.deleteMany({});
  res.send("reset done");
});

// Startup port
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  // Send startup notification to Telegram (so you know the service is live)
  try {
    await sendTelegram(`⚡ sumit403 backend deployed and running on port ${PORT}`);
    console.log("Startup telegram sent");
  } catch (e) {
    console.error("Startup telegram error:", e.response ? e.response.data : e.message);
  }
});
