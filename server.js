const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cors = require("cors");
const UAParser = require("ua-parser-js");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(".")); // serve frontend

// =======================
// CONFIG
// =======================

const MONGO_URI = "YOUR_MONGO_URI";
const BOT_TOKEN = "YOUR_BOT_TOKEN";
const CHAT_ID = "YOUR_CHAT_ID";

// 👉 Gmail (USE APP PASSWORD)
const EMAIL_USER = "yourgmail@gmail.com";
const EMAIL_PASS = "your_app_password";

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
// OTP STORE (TEMP)
// =======================

const otpStore = {};

// =======================
// MAIL SETUP
// =======================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

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

    if(!email || !email.endsWith("@gmail.com")){
      return res.status(400).json({error:"Only Gmail allowed"});
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiry: Date.now() + 5 * 60 * 1000,
      verified:false
    };

    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Verify your email",
      text: `Your OTP is: ${otp}`
    });

    res.json({message:"OTP sent"});

  }catch(err){
    console.log(err);
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

    // 🔐 CHECK VERIFIED
    const otpData = otpStore[email];

    if(!otpData || !otpData.verified){
      return res.status(403).json({error:"Email not verified"});
    }

    // ---------- IP detection ----------
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    // ---------- Browser ----------
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const browser = `${ua.browser.name || "Unknown"} ${ua.browser.version || ""}`;
    const device = ua.device.model || ua.os.name || "Desktop";

    // ---------- Country ----------
    let country="Unknown";

    try{
      const geo = await axios.get(`http://ip-api.com/json/${ip}`);
      if(geo.data && geo.data.country){
        country=geo.data.country;
      }
    }catch(e){
      console.log("Geo lookup failed");
    }

    // ---------- Save ----------
    let user = await User.findOne({email:email.toLowerCase()});

    if(!user){
      user=new User({
        name,
        email:email.toLowerCase()
      });

      await user.save();

      // ---------- Telegram ----------
      const msg=
`📄 Verified Documentation Visitor

Name: ${name}
Email: ${email} ✅

IP: ${ip}
Country: ${country}
Browser: ${browser}
Device: ${device}
`;

      await sendTelegram(msg);
      console.log("Telegram notification sent");
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
// RESET
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
  await sendTelegram(`⚡ Backend deployed\nPort: ${PORT}`);
});
