import { Router, Request, Response, Router as ExpressRouter } from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { db } from "@repo/db";
import { users } from "@repo/db/schemas";
import { eq } from "drizzle-orm";

const router: ExpressRouter = Router();

export function getGoogleOAuthClient(): any {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
];

router.get("/google", (req: Request, res: Response) => {
  const oauth2Client = getGoogleOAuthClient();

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // ensure we get a refresh token
  });
  
  res.redirect(authorizeUrl);
});

router.get("/google/callback", async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("No authentication code provided.");
    return;
  }

  try {
    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const userInfoResponse = await oauth2.userinfo.get();
    const userInfo = userInfoResponse.data;

    if (!userInfo.id || !userInfo.email || !userInfo.name) {
      res.status(400).send("Failed to get required user info from Google.");
      return;
    }

    // Upsert User
    const existingUsers = await db.select().from(users).where(eq(users.googleId, userInfo.id));
    let userRecord = existingUsers[0] || null;

    if (!userRecord) {
      const [newRow] = await db
        .insert(users)
        .values({
          googleId: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
        })
        .returning();
      userRecord = newRow as any;
    } else {
      const [updatedRow] = await db
        .update(users)
        .set({
          email: userInfo.email,
          name: userInfo.name,
          updatedAt: new Date(),
          ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
        })
        .where(eq(users.id, userRecord.id))
        .returning();
      userRecord = updatedRow as any;
    }

    if (!userRecord) {
      res.status(500).send("Database failed to process User Record.");
      return;
    }

    // Issue JWT with only user identity — Google tokens are persisted in users.googleRefreshToken
    // and loaded from the DB by workers. Do NOT embed tokens in JWT (size + security).
    const sessionToken = jwt.sign(
      { id: userRecord.id, email: userRecord.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/?token=${sessionToken}`);
  } catch (error) {
    console.error("Google OAuth API Error:", error);
    res.status(500).send("Authentication failed");
  }
});

export default router;
