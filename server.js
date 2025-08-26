import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json());

const TOKEN = "EAAWAgXDhgZCUBPRHZBNNoN6OcHCGsx8ryabRwVwgJYy4s7iWS6O0pJIolWHcoqYSrFLkPyTcUNJ0P1Cll242FROZBZBSQTEE9gPZC4KHGuqJrsy2IWZBscZBZA0IRcuxNN7NuoZBlXPujCY1cZBDYdNKZB5MdKugRLn20JITgRHT9dkn3QGSjOZCvgIvpV6IBee2vK5aLAZDZD";
const PHONE_ID = "726263847247512";
const VERIFY_TOKEN = "mikeben123";
const ADMIN_NUMBER = "94783811114";

// Serve static images
app.use("/images", express.static(path.join("/var/www/whatsappbot/images")));

async function sendMessage(to, text) {
  console.log(`[LOG] Sending message to ${to}: "${text}"`);
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log(`[SUCCESS] Message sent to ${to}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send message to ${to}:`, err.response?.data || err.message);
  }
}

async function sendImage(to, url) {
  console.log(`[LOG] Sending image to ${to}: ${url}`);
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: url },
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log(`[SUCCESS] Image sent to ${to}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send image to ${to}:`, err.response?.data || err.message);
  }
}

async function notifyAdmin(userNumber, userName, category) {
  const msg = `📩 New Request\nFrom: ${userName || "Unknown"} (${userNumber})\nCategory: ${category}`;
  console.log(`[LOG] Notifying admin: ${msg}`);
  await sendMessage(ADMIN_NUMBER, msg);
}

// Verification endpoint
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log(`[LOG] Webhook verification attempt: mode=${mode}, token=${token}`);
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[SUCCESS] Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.warn("[WARN] Webhook verification failed!");
    res.sendStatus(403);
  }
});

// Message handler
app.post("/webhook", async (req, res) => {
  console.log("[LOG] Incoming webhook payload received");
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) {
      console.log("[INFO] No message in payload");
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.trim();
    const userName = entry.contacts?.[0]?.profile?.name;

    console.log(`[LOG] Received message from ${from} (${userName || "Unknown"}): "${text}"`);

    if (!text) {
      console.log("[INFO] Message has no text, ignoring");
      return res.sendStatus(200);
    }

    if (text.toLowerCase() === "hi") {
      console.log("[LOG] Sending welcome message");
      await sendMessage(from, "Welcome! Choose a category:\n1. Cat\n2. House\n3. Tech\n4. Random");
    } else if (["1","2","3","4"].includes(text)) {
      const categories = { "1": "cat", "2": "house", "3": "tech", "4": "random" };
      const category = categories[text];
      const categoryPath = path.join("/var/www/whatsappbot/images", category);

      console.log(`[LOG] User selected category: ${category}`);
      try {
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
        if (!files.length) throw new Error("No images found");

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const url = `https://wtspimgbot.nuckz.live/images/${category}/${randomFile}`;

        console.log(`[LOG] Selected random image: ${randomFile}`);
        await sendImage(from, url);
        await sendMessage(from, "Choose again:\n1. Cat\n2. House\n3. Tech\n4. Random");
        await notifyAdmin(from, userName, category);
      } catch (err) {
        console.error("[ERROR] Image processing failed:", err.message);
        await sendMessage(from, "Sorry, no images available in this category right now.");
      }
    } else {
      console.log(`[INFO] Received unknown input: "${text}"`);
      await sendMessage(from, "Unknown option. Please type 'hi' to start or choose 1-4.");
    }

  } catch (err) {
    console.error("[ERROR] Webhook handling error:", err.message);
  }

  res.sendStatus(200);
});

app.listen(5500, () => console.log("✅ WhatsApp bot running on port 5500"));
