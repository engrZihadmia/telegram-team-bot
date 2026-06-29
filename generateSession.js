// EI SCRIPT TA EKBAR SHUDHU RUN KORTE HOBE — login session string
// generate korar jonno. Ei string ta .env file e USER_SESSION_STRING
// hisebe save kore rakhle, pore index.js baar baar interactive login
// chaibe na.
//
// Run kora: node generateSession.js

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // npm install input
import dotenv from "dotenv";

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

(async () => {
    console.log("Login shuru hocche...");
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5
    });

    await client.start({
        phoneNumber: async () => await input.text("Phone number diyo (+880... format e): "),
        password: async () => await input.text("2FA password (jodi thake, na thakle enter): "),
        phoneCode: async () => await input.text("Telegram theke asha login code diyo: "),
        onError: (err) => console.error(err)
    });

    console.log("\n✅ Login successful!\n");
    console.log("Niche ei session string ta copy kore .env file e USER_SESSION_STRING= er por paste koro:\n");
    console.log(client.session.save());
    console.log("\n⚠️ Ei string ta kauke share korba na — eta tomar full account access dey.");

    process.exit(0);
})();
