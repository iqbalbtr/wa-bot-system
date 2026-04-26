import { ChalangeType } from "../../bot/type/chalange";
import * as fs from 'fs';
import * as path from 'path';
import { Stream } from "stream";

export const successResponse = (message: string = "Success", data?: any) => {
    return {
        status: true,
        message: message,
        ...(data && { data }),
    };
}

export const getChalangeData = (): ChalangeType => {
    const currentChalangePath = path.resolve(process.cwd(), 'assets', 'chalange.json');

    if (!fs.existsSync(currentChalangePath)) {
        throw new Error('Data tantangan tidak ditemukan.');
    }

    let changelog: ChalangeType;
    try {
        changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
    } catch (e) {
        throw new Error('Gagal memuat konfigurasi chalange.');
    }

    return changelog;
}