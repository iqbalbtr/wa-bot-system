import { Hono } from "hono";
import { saveFileToTemp } from "../../shared/lib/storage";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { successResponse } from "../lib/util";
import { google_drive } from "../../bot/core/google-drive";

/**
 * required by OAuth2 flow.
 */

const google_auth_handler = new Hono();

google_auth_handler.get(
  "/",
  zValidator(
    "query",
    z.object({
      code: z.string({
        message: "code must be provided and cannot be empty",
      }),
      state: z.string({
        message: "state must be provided and canot be empty",
      }),
    }),
    (res) => {
      if (!res.success) {
        throw new HTTPException(400, {
          message: "Bad Request",
          cause: res.error,
        });
      }
    },
  ),
  async (c) => {
    const body = c.req.valid("query");

    if (body.state !== google_drive.state) {
      return c.text("Invalid OAuth state", 403);
    }

    const res = await google_drive.getTokenFromCode(body.code);

    if (!res) return c.text("failed!", 500);
    return c.text("new credential is saved!");
  },
);

export default google_auth_handler;
