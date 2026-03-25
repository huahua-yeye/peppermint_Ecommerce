import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../prisma";
import { EmailQueue } from "../types/email";

export class AuthService {
  public static generateXOAuth2Token(
    username: string,
    accessToken: string
  ): string {
    const authString = [
      `user=${username}`,
      `auth=Bearer ${accessToken}`,
      "",
      "",
    ].join("\x01");
    return Buffer.from(authString).toString("base64");
  }

  /** Gmail 队列 OAuth：须用 OAuth2Client + refresh_token，不能用 GoogleAuth.fromJSON（那会当成服务账号 JSON，要求 client_email） */
  static async getValidAccessToken(queue: EmailQueue): Promise<string> {
    const { clientId, clientSecret, refreshToken, accessToken, expiresIn, id } =
      queue;

    const cid = String(clientId ?? "").trim();
    const csec = String(clientSecret ?? "").trim();
    const rt = String(refreshToken ?? "").trim();
    if (!cid || !csec || !rt) {
      throw new Error(
        "Gmail queue missing clientId, clientSecret, or refreshToken"
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec =
      expiresIn !== undefined && expiresIn !== null
        ? Number(expiresIn as unknown as bigint | number)
        : 0;
    if (accessToken && expSec && nowSec < expSec - 120) {
      return accessToken;
    }

    const oauth2Client = new OAuth2Client(cid, csec);
    oauth2Client.setCredentials({
      refresh_token: rt,
    });

    const { token: newAccessToken } = await oauth2Client.getAccessToken();
    if (!newAccessToken) {
      throw new Error("Unable to refresh access token.");
    }

    const creds = oauth2Client.credentials;
    const expirySec = creds.expiry_date
      ? Math.floor(creds.expiry_date / 1000)
      : nowSec + 3600;

    await prisma.emailQueue.update({
      where: { id },
      data: {
        accessToken: newAccessToken,
        expiresIn: BigInt(expirySec),
      },
    });

    return newAccessToken;
  }
}
