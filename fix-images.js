const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function removeCheckerboard(inputPath, outputPath) {
    console.log(`Processing: ${inputPath}`);
    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        const data = await image
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = data.info;
        const pixels = data.data;

        // Checkerboard colors often found (adjust thresholds as needed)
        // White: 255, 255, 255
        // Grey: ~204, 204, 204 (0xCC) or similar often used in transparency grids

        let changed = 0;

        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // alpha is pixels[i+3] if existing

            // Detect White
            const isWhite = r > 240 && g > 240 && b > 240;
            // Detect Grey (common checkerboard grey is usually neutral)
            const isGrey = (Math.abs(r - g) < 10 && Math.abs(g - b) < 10) && (r > 150 && r < 210);

            // Simple heuristic: if likely background, set alpha to 0
            // Note: This is aggressive and might eat into the logo if it has white/grey parts.
            // A better approach for "generative checkerboards" is flood fill from corners, but let's try color keying first.

            if (isWhite || isGrey) {
                pixels[i + 3] = 0; // Set Alpha to 0
                changed++;
            }
        }

        console.log(`Changed ${changed} pixels.`);

        await sharp(pixels, {
            raw: {
                width,
                height,
                channels
            }
        })
            .png()
            .toFile(outputPath);

        console.log(`Saved to: ${outputPath}`);

    } catch (error) {
        console.error(`Error processing ${inputPath}:`, error);
    }
}

async function main() {
    const iconPath = path.join(__dirname, 'src/renderer/assets/icon.png');
    const logoPath = path.join(__dirname, 'src/renderer/assets/logo.png');

    // Process Icon
    await removeCheckerboard(iconPath, iconPath);
    // Copy processed icon to build
    fs.copyFileSync(iconPath, path.join(__dirname, 'build/icon.png'));

    // Process Logo (Optional, if we use it elsewhere)
    await removeCheckerboard(logoPath, logoPath);
}

main();
