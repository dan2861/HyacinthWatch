// Lightweight client-side brightness estimate, 0..255
export async function computeBrightness(blob, { crop = 0.6, size = 96 } = {}) {
    // crop: take the central % of the image (e.g., 0.6 = 60% central box)
    // size: downscale target for sampling (keep small for speed)

    const imgURL = URL.createObjectURL(blob);
    try {
        const img = await loadImage(imgURL);
        const { sx, sy, sw, sh } = centerCrop(img.naturalWidth, img.naturalHeight, crop);

        // draw crop to small canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        let sum = 0;
        // Use perceptual luma: Rec. 709
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255
            sum += y;
        }
        const pixels = (data.length / 4) || 1;
        return sum / pixels; // 0..255
    } finally {
        URL.revokeObjectURL(imgURL);
    }
}

// Client-side brightness quality score (0.0 to 1.0)
export function computeBrightnessScore(brightness) {
    if (typeof brightness !== 'number' || brightness < 0 || brightness > 255) {
        return 0.0;
    }

    // Optimal brightness range: 80-180 (good lighting conditions)
    // Based on server-side thresholds: >= 200 (bright), >= 50 (okay), < 50 (dark)

    if (brightness >= 80 && brightness <= 180) {
        // Optimal range - high score
        return 1.0;
    } else if (brightness >= 50 && brightness < 80) {
        // Slightly dim but acceptable - scale from 0.6 to 1.0
        return 0.6 + (brightness - 50) / 30 * 0.4;
    } else if (brightness > 180 && brightness <= 220) {
        // Slightly bright but acceptable - scale from 1.0 to 0.7
        return 1.0 - (brightness - 180) / 40 * 0.3;
    } else if (brightness > 220) {
        // Too bright - scale from 0.7 to 0.3
        const overBright = Math.min(brightness - 220, 35); // Cap at 255
        return Math.max(0.3, 0.7 - overBright / 35 * 0.4);
    } else {
        // Too dark (< 50) - scale from 0.0 to 0.6
        return Math.max(0.0, brightness / 50 * 0.6);
    }
}

// Client-side quality assessment - returns QC object similar to server
export async function computeClientQC(blob, options = {}) {
    try {
        const brightness = await computeBrightness(blob, options);
        const brightnessScore = computeBrightnessScore(brightness);

        // Overall score based on brightness (can be extended with more metrics)
        const overallScore = brightnessScore;

        return {
            brightness: brightness,
            brightnessScore: brightnessScore,
            score: overallScore,
            metrics: {
                brightness: {
                    value: brightness,
                    score: brightnessScore,
                    threshold: brightness >= 50 ? 'pass' : 'fail'
                }
            },
            timestamp: new Date().toISOString(),
            version: 'client-v1.0'
        };
    } catch (error) {
        console.warn('Client QC computation failed:', error);
        return {
            brightness: null,
            brightnessScore: 0.0,
            score: 0.0,
            error: error.message,
            timestamp: new Date().toISOString(),
            version: 'client-v1.0'
        };
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Helpful for local blobs; not needed cross-origin
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function centerCrop(w, h, crop) {
    crop = Math.min(Math.max(crop, 0.1), 1.0);
    const cw = Math.floor(w * crop);
    const ch = Math.floor(h * crop);
    return {
        sx: Math.floor((w - cw) / 2),
        sy: Math.floor((h - ch) / 2),
        sw: cw,
        sh: ch,
    };
}
