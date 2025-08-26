import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json());

const TOKEN = "EAAWAgXDhgZCUBPQCjMsuZAGZA6jmyqrIRiUnZBYN98dI5G21k5idzrA9SVCZCaZBEMNk6ob59UcpjdGcU2ZApQFFVZCJZBzImbfe6wI4DEVBmE4XmGrBCZAOEDIP5WQ5hXGh5EUvDTdBpxPLvcmMaSsCDPyxQo0xAV0zuYitA6j5tJtAYiz4FxI8v5VJGWPkalxYgjjwZDZD";
const PHONE_ID = "726263847247512";
const VERIFY_TOKEN = "mikeben123";
const ADMIN_NUMBER = "94783811114";

// Serve static images
app.use("/images", express.static(path.join("/var/www/whatsappbot/images")));

// Send text message
async function sendMessage(to, text) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to, text: { body: text } },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log(`[SUCCESS] Sent message to ${to}: "${text}"`);
  } catch (err) {
    console.error("[ERROR] Sending message:", err.response?.data || err.message);
  }
}

// Send image
async function sendImage(to, url) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "image", image: { link: url } },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log(`[SUCCESS] Sent image to ${to}: ${url}`);
  } catch (err) {
    console.error("[ERROR] Sending image:", err.response?.data || err.message);
  }
}

// Notify admin
async function notifyAdmin(userNumber, userName, category) {
  const msg = `📩 New Request\nFrom: ${userName || "Unknown"} (${userNumber})\nCategory: ${category}`;
  await sendMessage(ADMIN_NUMBER, msg);
}

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log(`[LOG] Webhook verification attempt: mode=${mode}, token=${token}`);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[SUCCESS] Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.log("[ERROR] Webhook verification failed");
    res.sendStatus(403);
  }
});

// Incoming messages handler
app.post("/webhook", async (req, res) => {
  console.log("[LOG] Incoming webhook payload:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) {
      console.log("[INFO] No messages found in payload");
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.trim();
    const userName = entry.contacts?.[0]?.profile?.name;
    console.log(`[LOG] Received message from ${from} (${userName || "Unknown"}): "${text}"`);

    if (!text) return res.sendStatus(200);

    // Respond to "hi"
    if (text.toLowerCase() === "hi") {
      console.log("[LOG] Sending welcome message");
      await sendMessage(from, "Welcome! Choose a category:\n1. Cat\n2. House\n3. Tech\n4. Random");
    } 
    // Respond to category numbers
    else if (["1","2","3","4"].includes(text)) {
      const categories = { "1": "cat", "2": "house", "3": "tech", "4": "random" };
      const category = categories[text];
      const categoryPath = path.join("/var/www/whatsappbot/images", category);

      try {
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
        if (!files.length) throw new Error("No images found in category");

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const url = `https://wtspimgbot.nuckz.live/images/${category}/${randomFile}`;
        console.log(`[LOG] Sending image ${url} to ${from}`);

        await sendImage(from, url);
        await sendMessage(from, "Choose again:\n1. Cat\n2. House\n3. Tech\n4. Random");
        await notifyAdmin(from, userName, category);
      } catch (err) {
        console.error("[ERROR] Image handling error:", err.message);
        await sendMessage(from, "Sorry, no images available in this category right now.");
      }
    }
  } catch (err) {
    console.error("[ERROR] Webhook handling error:", err.message);
  }

  res.sendStatus(200);
});

app.listen(5500, () => console.log("✅ WhatsApp bot running on port 5500"));
