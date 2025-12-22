import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOSL2_DIR = path.join(__dirname, '../public/libraries/BOSL2');
const OUTPUT_FILE = path.join(__dirname, '../public/bosl2_files.json');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file === '.git') return; // Ignore .git directory
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            // Only include .scad files or other assets if needed. 
            // For now, let's include everything except hidden files and markdown/license/etc if we want to be strict.
            // But let's just include everything to be safe for now, filtering out obvious non-library stuff.
            if (!file.startsWith('.')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

try {
    console.log(`Scanning ${BOSL2_DIR} for files...`);
    const allFiles = getAllFiles(BOSL2_DIR);

    // Convert absolute paths to relative paths from BOSL2_DIR
    const relativeFiles = allFiles.map(file => {
        return path.relative(BOSL2_DIR, file).split(path.sep).join('/');
    });

    console.log(`Found ${relativeFiles.length} files.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(relativeFiles, null, 2));
    console.log(`Successfully wrote file list to ${OUTPUT_FILE}`);

} catch (e) {
    console.error("Error generating BOSL2 file list:", e);
}
