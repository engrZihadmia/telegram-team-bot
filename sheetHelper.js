import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'oauth_config.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// স্কোপ: শুধু পড়ার অনুমতি
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

async function authorize() {
  // token.json থাকলে তা ব্যবহার করি
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const { client_id, client_secret, redirect_uris } = JSON.parse(
      fs.readFileSync(CREDENTIALS_PATH)
    ).installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  // নতুন অথেন্টিকেশন
  const authClient = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  // টোকেন সেভ করুন
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(authClient.credentials));
  return authClient;
}

// শীট আইডি বের করা (URL থেকে বা সরাসরি আইডি)
export function extractSheetId(input) {
  // যদি পুরো URL হয়
  const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // যদি সরাসরি আইডি হয় (অক্ষর ও ড্যাশ)
  if (/^[a-zA-Z0-9-_]+$/.test(input.trim())) return input.trim();
  return null;
}

// শীট থেকে ডেটা পড়া (কলাম A-D ধরে নিচ্ছি)
export async function fetchSheetRows(sheetId, range = 'A:D') {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  const rows = response.data.values;
  if (!rows || rows.length < 2) return []; // হেডার + ডেটা
  // প্রথম সারি হেডার ধরে বাদ দেই
  return rows.slice(1).filter(row => row.length >= 4);
}