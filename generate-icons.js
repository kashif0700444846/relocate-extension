// [LocationMagic] [generate-icons.js] - Generates extension icons using canvas
// Run: node generate-icons.js
// Creates icons/icon16.png, icons/icon48.png, icons/icon128.png

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

function drawIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    // Background: deep dark circle
    const bgGrad = ctx.createRadialGradient(cx, cy * 0.7, r * 0.1, cx, cy, r);
    bgGrad.addColorStop(0, '#1a0a3a');
    bgGrad.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Location pin shape (teardrop)
    const pinW = size * 0.4;
    const pinH = size * 0.52;
    const pinX = cx;
    const pinY = cy * 0.55;
    const pinRadius = pinW / 2;

    // Glow effect
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = size * 0.25;

    // Pin gradient fill
    const pinGrad = ctx.createLinearGradient(pinX - pinRadius, pinY - pinRadius, pinX + pinRadius, pinY + pinH);
    pinGrad.addColorStop(0, '#c084fc');
    pinGrad.addColorStop(0.5, '#8b5cf6');
    pinGrad.addColorStop(1, '#e879f9');
    ctx.fillStyle = pinGrad;

    // Draw teardrop
    ctx.beginPath();
    ctx.arc(pinX, pinY, pinRadius, Math.PI, 0, false);
    ctx.bezierCurveTo(pinX + pinRadius, pinY + pinH * 0.45, pinX + pinRadius * 0.2, pinY + pinH * 0.85, pinX, pinY + pinH);
    ctx.bezierCurveTo(pinX - pinRadius * 0.2, pinY + pinH * 0.85, pinX - pinRadius, pinY + pinH * 0.45, pinX - pinRadius, pinY);
    ctx.closePath();
    ctx.fill();

    // Inner white circle (hole in pin)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(pinX, pinY, pinRadius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Inner dot
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(pinX, pinY, pinRadius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Magic sparkles (small stars around)
    if (size >= 48) {
        ctx.fillStyle = '#f0abfc';
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = size * 0.1;

        const sparks = [
            { x: cx + size * 0.32, y: cy * 0.3, s: size * 0.04 },
            { x: cx - size * 0.35, y: cy * 0.4, s: size * 0.025 },
            { x: cx + size * 0.1, y: cy * 0.15, s: size * 0.03 },
        ];

        sparks.forEach(({ x, y, s }) => {
            ctx.beginPath();
            ctx.arc(x, y, s, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    return canvas.toBuffer('image/png');
}

[16, 48, 128].forEach(size => {
    const buffer = drawIcon(size);
    const outPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`[LocationMagic] Generated icon${size}.png`);
});

console.log('[LocationMagic] All icons generated successfully!');
