import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const student = sqliteTable("students", {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text(),
    nick: text(),
    nim: text().unique(),
    phone: text().notNull().unique(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
})

export const chalangeStudent = sqliteTable("chalange_students", {
    id: integer().primaryKey({ autoIncrement: true }),
    student_id: integer().notNull(),
    chalange_slug: text().notNull(),
    attachment: text().$type<string | null>().default(null),
    score: integer().default(0),
    last_updated: text().default(sql`(CURRENT_TIMESTAMP)`),
})

export const studentRelations = relations(student, ({ many }) => ({
    chalanges: many(chalangeStudent)
}))

export const chalangeStudentRelations = relations(chalangeStudent, ({ one }) => ({
    student: one(student, {
        fields: [chalangeStudent.student_id],
        references: [student.id]
    })
}))

export const schedules = sqliteTable("schedules", {
    id: integer().primaryKey({ autoIncrement: true }),
    scheduled_time: text().notNull(),
    message: text().notNull(),
    attachment: text().$type<string | null>().default(null),
    contact_ids: text({ mode: "json" }).$type<string>().notNull()
});

export const blockedUsers = sqliteTable("blocked_users", {
    id: integer().primaryKey({ autoIncrement: true }),
    block_reason: text(),
    contact_id: text().notNull(),
    blocked_at: text().default(sql`(CURRENT_TIMESTAMP)`),
});

export const groupSettings = sqliteTable("group_settings", {
    id: integer().primaryKey({ autoIncrement: true }),
    group_id: text().notNull(),
    settings: text({ mode: "json" }).$type<Array<{ key: string, value: boolean }>>().notNull()
})

export const tokens = sqliteTable("tokens", {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text(),
    token: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
})