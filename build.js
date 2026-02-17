const fs = require('fs');
const path = require('path');

// Configuration
const DIRS_TO_COPY = ['assets', 'data'];
const FILES_TO_COPY_EXT = ['.html']; // Copy all HTML files
const OUTPUT_DIRS = ['dist', 'build', 'public'];

console.log("🚀 Starting Bulletproof Build Script...");

// Helper to copy recursive
function copyRecursiveSync(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 1. Create Output Directories
OUTPUT_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`🧹 Cleaning ${dir}...`);
        fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log(`📁 Creating ${dir}...`);
    fs.mkdirSync(dir, { recursive: true });
});

// 2. Identify HTML files
const allFiles = fs.readdirSync('.');
const htmlFiles = allFiles.filter(file => FILES_TO_COPY_EXT.some(ext => file.endsWith(ext)));

// 3. Copy Content to All Output Dirs
OUTPUT_DIRS.forEach(outputDir => {
    console.log(`\n📦 Populating ${outputDir}...`);

    // Copy Directories
    DIRS_TO_COPY.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`   - Copying ${dir}/`);
            copyRecursiveSync(dir, path.join(outputDir, dir));
        } else {
            console.warn(`   ⚠️ Warning: Directory ${dir} not found!`);
        }
    });

    // Copy HTML Files
    htmlFiles.forEach(file => {
        console.log(`   - Copying ${file}`);
        fs.copyFileSync(file, path.join(outputDir, file));
    });
});

console.log("\n✅ Build Completed Successfully!");
