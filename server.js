const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cors = require("cors");
const UAParser = require("ua-parser-js");
const { Resend } = require("resend");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(".")); // serve frontend

// =======================
// ENV CONFIG (RENDER)
// =======================

const {
  MONGO_URI,
  BOT_TOKEN,
  CHAT_ID,
  RESEND_API_KEY
} = process.env;

// =======================
// INIT SERVICES
// =======================

const resend = new Resend(RESEND_API_KEY);

// =======================
// MongoDB
// =======================

mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB connected"))
.catch(err=>console.log("Mongo error:",err));

// =======================
// User Model
// =======================

const User = mongoose.model("User",{
  name:String,
  email:String,
  createdAt:{type:Date,default:Date.now}
});

// =======================
// OTP STORE (TEMP MEMORY)
// =======================

const otpStore = {};

// =======================
// Telegram helper
// =======================

async function sendTelegram(text){
  try{
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{
      chat_id:CHAT_ID,
      text:text
    });
  }catch(err){
    console.log("Telegram error",err.response?.data || err.message);
  }
}

// =======================
// SEND OTP
// =======================

app.post("/send-otp", async (req,res)=>{
  try{
    const {email} = req.body;

    if(!email){
      return res.status(400).json({error:"Email required"});
    }

    // optional restriction
    if(!email.endsWith("@gmail.com")){
      return res.status(400).json({error:"Only Gmail allowed"});
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiry: Date.now() + 5 * 60 * 1000,
      verified:false
    };

    await resend.emails.send({
      from: "Reigen <verify@reigenwrites.com>",
      to: email,
      subject: "Verify your email",
      html: `
        <div style="font-family:sans-serif;">
          <h2>Email Verification</h2>
          <p>Your OTP is:</p>
          <h1 style="letter-spacing:5px;">${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      `
    });

    res.json({message:"OTP sent"});

  }catch(err){
    console.log("OTP error:", err);
    res.status(500).json({error:"Failed to send OTP"});
  }
});

// =======================
// VERIFY OTP
// =======================

app.post("/verify-otp", (req,res)=>{
  const {email, otp} = req.body;

  const data = otpStore[email];

  if(!data){
    return res.status(400).json({error:"No OTP found"});
  }

  if(Date.now() > data.expiry){
    return res.status(400).json({error:"OTP expired"});
  }

  if(data.otp !== otp){
    return res.status(400).json({error:"Invalid OTP"});
  }

  data.verified = true;

  res.json({message:"Email verified"});
});

// =======================
// REGISTER (ONLY VERIFIED)
// =======================

app.post("/register", async (req,res)=>{
  try{

    const {name,email}=req.body;

    if(!name || !email){
      return res.status(400).json({error:"missing fields"});
    }

    // 🔐 OTP CHECK
    const otpData = otpStore[email];

    if(!otpData || !otpData.verified){
      return res.status(403).json({error:"Email not verified"});
    }

    // ---------- IP ----------
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    // ---------- DEVICE ----------
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const browser = `${ua.browser.name || "Unknown"} ${ua.browser.version || ""}`;
    const device = ua.device.model || ua.os.name || "Desktop";

    // ---------- COUNTRY ----------
    let country="Unknown";

    try{
      const geo = await axios.get(`http://ip-api.com/json/${ip}`);
      if(geo.data?.country){
        country=geo.data.country;
      }
    }catch(e){
      console.log("Geo lookup failed");
    }

    // ---------- SAVE ----------
    let user = await User.findOne({email:email.toLowerCase()});

    if(!user){
      user=new User({
        name,
        email:email.toLowerCase()
      });

      await user.save();

      // ---------- TELEGRAM ----------
      const msg =
`📄 Verified Documentation Visitor

Name: ${name}
Email: ${email} ✅

IP: ${ip}
Country: ${country}
Browser: ${browser}
Device: ${device}
`;

      await sendTelegram(msg);
    }

    // 🧹 cleanup
    delete otpStore[email];

    res.json({status:"ok"});

  }catch(err){
    console.log("Register error",err);
    res.status(500).json({error:"server error"});
  }
});

// =======================
// COUNT
// =======================

app.get("/count", async (req,res)=>{
  try{
    const count = await User.countDocuments();
    res.json({count});
  }catch(err){
    res.status(500).json({error:"server error"});
  }
});

// =======================
// RESET (optional)
// =======================

app.get("/admin/reset", async (req,res)=>{
  await User.deleteMany({});
  res.send("All users deleted");
});

// =======================
// START SERVER
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async ()=>{
  console.log(`Server started on port ${PORT}`);

  try{
    await sendTelegram(`⚡ Backend deployed\nPort: ${PORT}`);
  }catch(e){}
});
