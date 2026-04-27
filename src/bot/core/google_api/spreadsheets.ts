import { sheets_v4, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { get_env } from "../../lib/util";
import Stream from "stream";

class GoogleSpreadSheets {
  private sheet?: sheets_v4.Sheets;

  constructor() {}

  updateSheetAPI(auth_client: OAuth2Client) {
    this.sheet = google.sheets({
      version: "v4",
      auth: auth_client,
    });
  }

  async updateSheets(sheetsId: string, values: any[][], range: string = "Sheet1!A1") {
    if (!this.sheet) throw new Error("GoogleSpreadSheets is not ready to use");

    const resource = {
      values: values,
    };

    await this.sheet.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      valueInputOption: "RAW",
      range,
      requestBody: resource,
    });
  }

  async reaedSheets(sheetsId: string, range?: string) {
    if (!this.sheet) throw new Error("GoogleSpreadSheets is not ready to use");

    const res = await this.sheet.spreadsheets.values.get({
      spreadsheetId: sheetsId,
      range,
    });
    return res.data
  }

}

export default GoogleSpreadSheets;
