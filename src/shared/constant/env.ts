import "dotenv/config"

export const prefix = process.env.PREFIX! || "!"
export const devId = process.env.DEV_ID! || ""
export const databaseUrl = process.env.DATABASE_URL! || ""
export const port = process.env.PORT! || ""
export const secretKey = process.env.SECRET_KEY! || ""
export const eventGroupId = process.env.EVENT_GROUP_ID! || ""