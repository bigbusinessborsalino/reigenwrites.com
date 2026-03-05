const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect("mongodb+srv://sekiro:reigen100@cluster0.dwxnugf.mongodb.net/?appName=Cluster0");

const User = mongoose.model("User", {
  name: String,
  email: String
});

const TELEGRAM_TOKEN = "8207709513:AAHmcYeKb3OXcuO4KpxZSRZAGDVEhoXyAMQ";
const CHAT_ID = "-1003825143216";

app.post("/register", async (req, res) => {

  const {name, email} = req.body;

  let user = await User.findOne({email});

  if(!user){

    user = new User({name,email});
    await user.save();

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: `New visitor\nName: ${name}\nEmail: ${email}`
      }
    );

  }

  res.json({status:"ok"});
});

app.listen(3000);
