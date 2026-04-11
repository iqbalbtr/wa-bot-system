import logger from "../../shared/lib/logger";
import db from "../index";
import fs from "fs";
import { student as studentTable } from "../schema";
import { join, resolve } from "path";
import { eq, or } from "drizzle-orm";

class Sheeder {
  private skipped_count = 0;
  private success_count = 0;
  private error_count = 0;

  constructor() {
    this.run();
  }

  async run() {
    try {
      await this.seedUser();
    } catch (error) {
      logger.error("Failed to run seeder: ", error);
    } finally {
      logger.info(
        `Seeding finished. success: ${this.success_count}, skipped: ${this.skipped_count}, errors: ${this.error_count}`,
      );
    }
  }

  async seedUser() {
    logger.info("Start Sedding..");
    const students = this.importJsonFile("student.json");

    for (const studentData of students) {
      const is_registered = !!(
        await db
          .select()
          .from(studentTable)
          .where(or(eq(studentTable.nim, studentData.nim), eq(studentTable.phone, studentData.phone)))
      ).length;

      if (is_registered) {
        logger.info(`${studentData.name} NIM of phone number was allready registered, skipped.`);
        this.skipped_count++;
        continue;
      }

      await this.storeData(async () => {
        await db.insert(studentTable).values({
          phone: studentData.phone,
          name: studentData.name,
          nick: studentData.nick,
          nim: studentData.nim,
        });
      });
    }
  }

  private async storeData(cb: () => Promise<void>) {
    try {
      await cb();
      this.success_count++;
    } catch (error: any) {
      this.error_count++;
      logger.error(`[${name}] | ${error.message}`);
    }
  }

  private importJsonFile(filePath: string): any[] {
    try {
      const fullPath = resolve(join(__dirname, "data", filePath)); // Pastikan folder 'data' ada
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      return JSON.parse(fileContent);
    } catch (e: any) {
      logger.error(`Failed to load JSON: ${filePath} - ${e.message}`);
      throw e;
    }
  }
}

const seeder = new Sheeder();
