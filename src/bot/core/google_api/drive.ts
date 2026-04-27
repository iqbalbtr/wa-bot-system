import { drive_v3, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { get_env } from "../../lib/util";
import Stream from "stream";

class GoogleDrive {
  private drive?: drive_v3.Drive;
  private folderPathCache = new Map<string, string>();


  private BASE_FOLDER_ID: string;
  constructor() {
    const BASE_FOLDER = get_env("DRIVE_BASE_FOLDER");
    this.BASE_FOLDER_ID = BASE_FOLDER;

  }

  updateDrive(auth_client: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth: auth_client });
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
      const cacheKey = `${current_folder_id}/${foldername}`;

      if (this.folderPathCache.has(cacheKey)) {
        current_folder_id = this.folderPathCache.get(cacheKey)!;
        continue;
      }

      let next_folder = await this.search(current_folder_id, foldername);

      if (!next_folder || !next_folder.id) {
        let new_folder = await this.createFolder(current_folder_id, foldername);
        current_folder_id = new_folder.id!;
      } else {
        current_folder_id = next_folder.id;
      }

      this.folderPathCache.set(cacheKey, current_folder_id);
    }

    return current_folder_id;
  }


  /**
   * get list inside some folder id
   * @param folderId folder id
   * @returns
   */
  async list(folderId: string) {
    if (!this.drive) throw new Error("Google Drive API is not ready to use");
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
    if (!this.drive) throw new Error("Google Drive API is not ready to use");

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
    if (!this.drive) throw new Error("Google Drive API is not ready to use");

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

  async createNewSheet(name: string, folder_id: string) {
    if (!this.drive) throw new Error("Google Drive API is not ready to use");

    const result = await this.drive.files.create({
      requestBody: {
        name: name,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [folder_id],
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
    if (!this.drive) throw new Error("Google Drive API is not ready to use");

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

export default GoogleDrive;
