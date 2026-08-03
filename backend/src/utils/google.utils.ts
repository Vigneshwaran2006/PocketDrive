import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

export const getGoogleAuthUrl = (): string => {
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
  });

  return url;
};

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export const getGoogleUser = async (code: string): Promise<GoogleUserInfo> => {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get Google user info");
  }

  const data = await response.json();

  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
    email_verified: data.verified_email,
  };
};