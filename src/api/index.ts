import { Hono } from "hono"
import scheduleHandler from "./handler/schedule";
import contactHandler from "./handler/contact";
import { authMiddleware } from "./middleware/auth";
import messageRoute from "./handler/message";
import blockHandler from "./handler/block";
import uploadHandler from "./handler/upload";
import { HTTPException } from "hono/http-exception";
import dashboardHandler from "./handler/dashboard";
import google_auth_handler from "./handler/google_oauth_callback";

/**
 * 
 * Kamu bisa mengatur konfigurasi route dan rest API server disini
 */
const api = new Hono()

// this sould be public..
api.route("/oauth2callback", google_auth_handler);

api.use("*", authMiddleware);

api.route("/message", messageRoute);
api.route("/contacts", contactHandler);
api.route("/schedules", scheduleHandler);
api.route("/blocks", blockHandler);
api.route("/upload", uploadHandler);
api.route("/dashboard", dashboardHandler);

api.onError((err, c) => {
    
    if(err instanceof HTTPException) {
        const zodError = (err as any).cause.issues;
        
        return c.json({
            status: false,
            message: err.message ?? "An error occurred",
            ...(zodError&& {
                error: zodError
            })
        }, err.status);
    } else {
        return c.json({
            status: false,
            message: "Internal Server Error"
        }, 500);
    }
})

export default api;