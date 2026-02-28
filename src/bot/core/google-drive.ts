import { drive_v3, google } from "googleapis";
import crypto from "crypto";
import { get_env } from "../lib/util";
import logger from "../../shared/lib/logger";
import Stream from "stream";
import db from "../../database";
import { tokens } from "../../database/schema";
import { eq } from "drizzle-orm";

// nama token yang akan di simpan ke dalam database
const TOKEN_NAME = "google-auth-token";

/**
 * Mengelola autentikasi dan memberikan fungsi list dan upload ke drive
 * untuk keperluan menyimpan submitan
 */
class GoogleDrive {
  private BASE_FOLDER_ID: string;
  private drive?: drive_v3.Drive;
  private auth_client: any;
  state: string;

  constructor() {
    const BASE_FOLDER = get_env("DRIVE_BASE_FOLDER");
    const CLIENT_ID = get_env("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = get_env("GOOGLE_CLIENT_SECRED");
    const APP_URL = get_env("BASE_URL");

    this.BASE_FOLDER_ID = BASE_FOLDER;
    const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, `${APP_URL}/oauth2callback`);
    this.state = crypto.randomBytes(32).toString("hex");
    this.auth_client = oauth;

    this.init();
  }

  getAuthUrl(scopes: string[] = ["https://www.googleapis.com/auth/drive"]) {
    return this.auth_client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: this.state,
    });
  }

  /**
   * used for handling new code from /oauth2callback api. if refresh token exist,
   * the refresh will be saved in db.
   * @param code google callback code
   * @returns null if operation failed
   */
  async getTokenFromCode(code: string) {
    try {
      const { tokens: res } = await this.auth_client.getToken(code);
      if (res.refresh_token) {
        const saved_token = (await db.select().from(tokens).where(eq(tokens.name, TOKEN_NAME)).limit(1))[0];
        if (saved_token) await db.update(tokens).set({ token: res.refresh_token }).where(eq(tokens.name, TOKEN_NAME));
        else await db.insert(tokens).values({ name: TOKEN_NAME, token: res.refresh_token });
      }
      this.auth_client.setCredentials(res);
      this.updateDriveApi();
      return res;
    } catch (error) {
      logger.error("error while updating credentials", error);
      return null;
    }
  }

  async updateDriveApi() {
    this.drive = google.drive({ version: "v3", auth: this.auth_client });
    await this.auth_client.getAccessToken();
  }

  /**
   * initialing command. will use refresh token from db, if does not exist
   * this function will log new url auth in console.
   */
  async init() {
    try {
      const saved_token = (await db.select().from(tokens).where(eq(tokens.name, TOKEN_NAME)).limit(1))[0];

      if (!saved_token || !saved_token.token) {
        throw Error("no saved key found");
      }
      this.auth_client.setCredentials({ refresh_token: saved_token.token });
      await this.updateDriveApi();
    } catch (error) {
      const oauth_url = this.getAuthUrl();
      logger.info(`open this in browser to cnnect with google drive: ${oauth_url}`, error);
    }
  }

  /**
   *
   * @param path path destination
   * @returns folder id
   *
   *  @example google_drive.getTargetFolder(["path","to","dest"]); // will be base/path/to/dest in drive
   */
  async getTargetFolder(path: string[]) {
    let current_folder_id = this.BASE_FOLDER_ID;

    for (const foldername of path) {
      let next_folder = await this.search(current_folder_id, foldername);

      if (!next_folder || !next_folder.id) {
        let new_folder = await this.createFolder(current_folder_id, foldername);
        current_folder_id = new_folder.id!;
      } else {
        current_folder_id = next_folder.id;
      }
    }

    return current_folder_id;
  }

  /**
   * get list inside some folder id
   * @param folderId folder id
   * @returns
   */
  async list(folderId: string) {
    if (!this.drive) throw Error("google drive auth is not clear");
    const folder_list = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType)",
    });

    return folder_list.data.files;
  }

  /**
   * will return single file/folder that match the name.
   * @param folderId folder id
   * @param name name
   * @returns
   */
  async search(folderId: string, name: string) {
    if (!this.drive) throw Error("google drive auth is not clear");

    const folder_list = await this.drive.files.list({
      q: [`'${folderId}' in parents and trashed=false`, `name = '${name.replace(/'/g, "\\'")}'`].join(" and "),
      fields: "files(id, name)",
    });

    return folder_list.data.files?.[0];
  }

  /**
   * create folder and return the folder data.
   * @param folderId parest folder id
   * @param name folder name
   * @returns folder data
   */
  async createFolder(folderId: string, name: string) {
    if (!this.drive) throw Error("google drive auth is not clear");

    const result = await this.drive.files.create({
      requestBody: {
        name: name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [folderId],
      },
      fields: "id, name",
    });

    return result.data;
  }

  /**
   * upload an image from stream, and return the file data
   * @param image stream of file
   * @param name name file
   * @param folder_id folder parent id
   * @returns file
   */
  async uploadImageFromStream(image: Stream.Transform, name: string, folder_id: string) {
    if (!this.drive) throw Error("google drive auth is not clear");

    const result = await this.drive.files.create({
      media: {
        body: image,
        mimeType: "image/jepg",
      },
      requestBody: {
        parents: [folder_id],
        name,
      },
    });

    return result.data;
  }
}

export const google_drive = new GoogleDrive();
