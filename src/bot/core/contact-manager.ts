import { promises as fs } from "fs";
import { Contact } from "baileys";
import { WhatsappClient } from "./whatsaap";
import path from "path";

/**
 * Mengelola daftar kontak, khususnya kontak grup.
 * Bertanggung jawab untuk memuat, menyimpan, dan menyediakan akses ke data kontak dari/ke file.
 */
export class ContactManager {
   
    private contacts: Contact[] = [];
    private readonly client: WhatsappClient;

    private readonly contactsFilePath: string;

    constructor(client: WhatsappClient) {
        this.client = client;
        this.contactsFilePath = path.join(process.cwd(), "temp", "assets", "contacts.json");
    }

    /**
     * Menginisialisasi manager dengan membuat direktori yang diperlukan dan memuat kontak dari file.
     */
    public async initialize(): Promise<void> {
        try {
            await fs.mkdir(path.dirname(this.contactsFilePath), { recursive: true });
            await this.loadContacts();
        } catch (error) {
            this.client.logger.error("Failed to initialize ContactManager:", error);
        }
    }

    /**
     * Mengembalikan semua kontak grup yang saat ini tersimpan di memori.
     * @returns Array berisi objek Contact.
     */
    public getAllContacts(): Contact[] {
        return this.contacts;
    }

    /**
     * Mengatur dan menyimpan daftar kontak baru.
     * Kontak akan difilter untuk hanya menyertakan grup yang valid sebelum disimpan.
     * @param newContacts Array kontak baru yang akan diatur.
     */
    public async setContacts(newContacts: Contact[]): Promise<void> {
        const validGroups = this.filterValidGroups(newContacts);
        this.contacts = validGroups; // Perbarui state di memori
        await this.saveContacts(validGroups); // Simpan state yang sama ke file
    }

    /**
     * Menyimpan daftar kontak ke file JSON.
     * @param contactsToSave Daftar kontak yang akan disimpan.
     */
    private async saveContacts(contactsToSave: Contact[]): Promise<void> {
        try {
            const data = JSON.stringify(contactsToSave, null, 2);
            await fs.writeFile(this.contactsFilePath, data, "utf-8");
            this.client.logger.info(`Successfully saved ${contactsToSave.length} contacts to file.`);
        } catch (error) {
            this.client.logger.error("Failed to save contacts to file:", error);
        }
    }

    /**
     * Memuat daftar kontak dari file JSON.
     */
    private async loadContacts(): Promise<void> {
        try {
          
            const data = await fs.readFile(this.contactsFilePath, "utf-8");
            const loadedContacts = JSON.parse(data) as Contact[];
            this.contacts = this.filterValidGroups(loadedContacts);
            this.client.logger.info(`Successfully loaded ${this.contacts.length} contacts from file.`);
        } catch (error) {

            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                this.client.logger.warn("contacts.json not found. A new one will be created upon contact update.");
            } else {
                this.client.logger.error("Failed to load contacts from file:", error);
            }
        }
    }

    /**
     * Fungsi pembantu untuk memfilter array kontak, hanya menyisakan grup yang valid.
     * @param contacts Array kontak untuk difilter.
     * @returns Array kontak yang sudah difilter.
     */
    private filterValidGroups(contacts: Contact[]): Contact[] {
        return contacts.filter(
            contact => contact.id && contact.name && contact.id.endsWith("@g.us")
        );
    }
}