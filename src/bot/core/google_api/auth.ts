import { drive_v3, google } from "googleapis";
import { OAuth2Client, Credentials } from "google-auth-library";
import crypto from "crypto";
import { get_env, get_env_optional } from "../../lib/util";
import logger from "../../../shared/lib/logger";
import Stream from "stream";
import GoogleDrive from "./drive";
import GoogleSpreadSheets from "./spreadsheets";

/**
 * Mengelola autentikasi dan memberikan fungsi list dan upload ke drive
 * untuk keperluan menyimpan submitan
 */
class GoogleApi {
  private auth_client: OAuth2Client;
  state?: string;
  drive: GoogleDrive;
  sheet: GoogleSpreadSheets;

  constructor() {
    const CLIENT_ID = get_env("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = get_env("GOOGLE_CLIENT_SECRED");
    const REFRESH_TOKEN = get_env_optional("GOOGLE_REFRESH_TOKEN");
    const APP_URL = get_env("BASE_URL");

    const oauth = new google.auth.OAuth2({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirectUri: `${APP_URL}/oauth2callback`,
    });

    this.auth_client = oauth;
    this.drive = new GoogleDrive();
    this.sheet = new GoogleSpreadSheets()

    if (REFRESH_TOKEN) {
      this.updateAuth({
        refresh_token: REFRESH_TOKEN,
      });
    } else {
      const oauth_url = this.generateAuthUrl();
      logger.info(`open this in browser to connect with google: ${oauth_url}`);
    }
  }

  generateAuthUrl(
    scopes: string[] = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"],
  ) {
    this.state = crypto.randomBytes(32).toString("hex");

    return this.auth_client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: this.state,
    });
  }

  async updateAuth(res: Credentials) {
    this.auth_client.setCredentials(res);
    // await this.auth_client.getAccessToken();

    const expiry = this.auth_client.credentials.expiry_date;
    if (!this.auth_client.credentials.refresh_token) {
      logger.warn(`refresh token. google api access will fail after ${(expiry || 0) / 1000 / 60}`);
    }

    this.drive.updateDrive(this.auth_client);
    this.sheet.updateSheetAPI(this.auth_client);
  }

  /**
   * used for handling new code from /oauth2callback api. if refresh token exist,
   * the refresh will be logged to console.
   * @param code google callback code
   * @returns null if operation failed
   */
  async getTokenFromCode(code: string) {
    try {
      const { tokens } = await this.auth_client.getToken(code);
      if (tokens.refresh_token) {
        logger.info(`Got Api Refrash Key! now you can update the key onto .env : ${tokens.refresh_token}`);
      }
      await this.updateAuth(tokens);
      return tokens;
    } catch (error) {
      logger.error("error while updating credentials", error);
      return null;
    }
  }
}

const google_api = new GoogleApi();

export default google_api;
