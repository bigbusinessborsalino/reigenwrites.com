const express = require("express")
const axios = require("axios")
const mongoose = require("mongoose")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cors())

// ---------- HARD CODED CONFIG ----------

// MongoDB connection
const MONGO_URI = "mongodb+srv://sekiro:reigen100@cluster0.dwxnugf.mongodb.net/?appName=Cluster0"

// Telegram bot
const BOT_TOKEN = "8207709513:AAHmcYeKb3OXcuO4KpxZSRZAGDVEhoXyAMQ"
const CHAT_ID = "-1003825143216"

// ---------------------------------------

mongoose.connect(MONGO_URI)
.then(()=>console.log("MongoDB connected"))
.catch(err=>console.log(err))

const User = mongoose.model("User",{
name:String,
email:String
})

app.post("/register", async (req,res)=>{

try{

const {name,email} = req.body

let user = await User.findOne({email})

if(!user){

user = new User({name,email})
await user.save()

await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{
chat_id:CHAT_ID,
text:`New Documentation Visitor\n\nName: ${name}\nEmail: ${email}`
})

}

res.json({status:"ok"})

}catch(err){

console.log(err)
res.status(500).send("error")

}

})


// ---------- RENDER PORT ----------
const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
console.log("Server running on port "+PORT)
})
