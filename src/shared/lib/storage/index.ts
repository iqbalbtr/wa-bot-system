import path, { join } from "path";
import fs, { mkdirSync, writeFileSync } from "fs"
import logger from "../logger";


export function saveFileToTemp(data: string | NodeJS.ArrayBufferView, output: string[], ext: string, cb?: (result: { outputFolder: string; filename: string; outputFolderFile: string; }, isDelete: () => void) => void) {

    const outputFolder = join(process.cwd(), 'temp', ...output, Date.now().toString());

    mkdirSync(outputFolder, { recursive: true })

    const filename = Date.now() + ext;    

    writeFileSync(path.join(outputFolder, filename), data)

    const result = {
        outputFolder,
        filename,
        outputFolderFile: path.join(outputFolder, filename)
    }

    function deleteFile() {
        try {
            fs.unlinkSync(result.outputFolderFile);
            fs.rmdirSync(outputFolder);
        } catch (error) {
            logger.warn("Error deleting file:", error);
        }
    }

    cb && cb(result, deleteFile)

    return result
}