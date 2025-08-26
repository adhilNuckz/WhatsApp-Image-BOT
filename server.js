import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json());

const TOKEN = "EAAWAgXDhgZCUBPTts2HXRItIdPgBYt2p66UD7mremj80OXhvA5XjJPm2PQ1MmgKOmw3gtx0dhvwHx3E6i7mgpKvwgXp0ftiyxKW35yX1Cz31B440ykzYUQfE5Ceadlo0FoNg5FuSlVyhyjYnWa3JBUBalZBXfcyhDSAe9lOl9QtPJvADpXDD8LM3rVsBqoYLQJsKjZCogRwONtpkJKuhZC045JdfixUeGlkhxLyX8Lqpb6uA";
const PHONE_ID = "726263847247512";
const VERIFY_TOKEN = "mikeben123";
const ADMIN_NUMBER = "94783811114";

// Serve static images directly
app.use("/images", express.static(path.join("/var/www/whatsappbot/images")));

async function sendMessage(to, text) {
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
  } catch (err) {
    console.error("Error sending message:", err.response?.data || err.message);
  }
}

async function sendImage(to, url) {
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
  } catch (err) {
    console.error("Error sending image:", err.response?.data || err.message);
  }
}

async function notifyAdmin(userNumber, userName, category) {
  const msg = `📩 New Request\nFrom: ${userName || "Unknown"} (${userNumber})\nCategory: ${category}`;
  await sendMessage(ADMIN_NUMBER, msg);
}

// Verification endpoint
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Message handler
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim();
    const userName = entry.contacts?.[0]?.profile?.name;

    if (!text) return res.sendStatus(200);

    if (text.toLowerCase() === "hi") {
      await sendMessage(from, "Welcome! Choose a category:\n1. Cat\n2. House\n3. Tech\n4. Random");
    } else if (["1","2","3","4"].includes(text)) {
      const categories = { "1": "cat", "2": "house", "3": "tech", "4": "random" };
      const category = categories[text];
      const categoryPath = path.join("/var/www/whatsappbot/images", category);

      try {
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
        if (!files.length) throw new Error("No images found");

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const url = `https://wtspimgbot.nuckz.live/images/${category}/${randomFile}`;

        await sendImage(from, url);
        await sendMessage(from, "Choose again:\n1. Cat\n2. House\n3. Tech\n4. Random");
        await notifyAdmin(from, userName, category);
      } catch (err) {
        console.error("Image error:", err.message);
        await sendMessage(from, "Sorry, no images available in this category right now.");
      }
    }
  } catch (err) {
    console.error("Webhook handling error:", err.message);
  }

  res.sendStatus(200);
});

app.listen(5500, () => console.log("✅ WhatsApp bot running on port 5500"));
