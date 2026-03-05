const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cors = require("cors");
const UAParser = require("ua-parser-js");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(".")); // serve index.html and docs.html


// =======================
// CONFIG
// =======================

const MONGO_URI = "mongodb+srv://sekiro:reigen100@cluster0.dwxnugf.mongodb.net/docs";

const BOT_TOKEN = "8207709513:AAHmcYeKb3OXcuO4KpxZSRZAGDVEhoXyAMQ";

const CHAT_ID = "-1003825143216";


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
// Register endpoint
// =======================

app.post("/register", async (req,res)=>{

try{

const {name,email}=req.body;

if(!name || !email){

return res.status(400).json({error:"missing fields"});

}


// ---------- IP detection ----------

const ip =
req.headers["x-forwarded-for"]?.split(",")[0] ||
req.socket.remoteAddress ||
"unknown";


// ---------- Browser / device ----------

const parser = new UAParser(req.headers["user-agent"]);

const ua = parser.getResult();

const browser = `${ua.browser.name || "Unknown"} ${ua.browser.version || ""}`;

const device = ua.device.model || ua.os.name || "Desktop";


// ---------- Country lookup ----------

let country="Unknown";

try{

const geo = await axios.get(`http://ip-api.com/json/${ip}`);

if(geo.data && geo.data.country){

country=geo.data.country;

}

}catch(e){

console.log("Geo lookup failed");

}


// ---------- Check duplicate ----------

let user = await User.findOne({email:email.toLowerCase()});


if(!user){

user=new User({
name,
email:email.toLowerCase()
});

await user.save();


// ---------- Telegram message ----------

const msg=
`📄 New Documentation Visitor

Name: ${name}
Email: ${email}

IP: ${ip}
Country: ${country}
Browser: ${browser}
Device: ${device}
`;

await sendTelegram(msg);

console.log("Telegram notification sent");

}

res.json({status:"ok"});

}catch(err){

console.log("Register error",err);

res.status(500).json({error:"server error"});

}

});


// =======================
// Count endpoint
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
// Reset users (optional)
// =======================

app.get("/admin/reset", async (req,res)=>{

await User.deleteMany({});

res.send("All users deleted");

});


// =======================
// Start server
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async ()=>{

console.log(`Server started on port ${PORT}`);

await sendTelegram(`⚡ Documentation backend deployed on Render\nPort: ${PORT}`);

});
