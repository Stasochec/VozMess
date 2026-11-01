import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. High-tech, sleek Vozduxan vector icon SVG
const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Rich Orange Theme Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF9500" />
      <stop offset="50%" stop-color="#FF7A00" />
      <stop offset="100%" stop-color="#FF4D00" />
    </linearGradient>

    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="jetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFF3E8" />
    </linearGradient>

    <linearGradient id="streamGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFE0B2" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#FFFFFF" />
    </linearGradient>

    <filter id="vortexShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#802800" flood-opacity="0.4" />
    </filter>

    <filter id="streamGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Base Squircle -->
  <rect x="0" y="0" width="512" height="512" rx="124" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="512" height="256" rx="124" fill="url(#glowGrad)" />

  <!-- Ambient Air Ring Orbit -->
  <circle cx="256" cy="256" r="176" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="4" stroke-dasharray="14 14" />
  
  <!-- VOZDUXAN Vortex Stream & Speech V Wing -->
  <g filter="url(#vortexShadow)">
    <!-- Primary Air Stream Flow (Vortex swirl converting into speech bubble tail) -->
    <path d="M 132 292 C 124 230, 168 156, 252 148 C 342 140, 396 200, 388 280 C 382 342, 326 384, 256 384 C 206 384, 164 366, 138 344 L 112 376 C 104 386, 92 378, 96 366 L 114 308 C 110 298, 110 286, 112 274"
          fill="none" stroke="url(#streamGrad)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Center Dynamic Supersonic V-Wing -->
    <path d="M 172 196 L 252 352 C 258 364, 274 364, 280 352 L 358 196"
          fill="none" stroke="url(#jetGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Inner Core Air Velocity Blade -->
    <path d="M 232 220 L 266 288 L 300 220"
          fill="none" stroke="#FF7A00" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Leading Edge High-speed Air Stream Spark -->
    <circle cx="362" cy="192" r="14" fill="#FFFFFF" filter="url(#streamGlow)" />
    <circle cx="168" cy="192" r="10" fill="#FFFFFF" filter="url(#streamGlow)" />
  </g>
</svg>
`;

// 2. Favicon SVG (simplified clean version for small tab sizes)
const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="favBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF9500" />
      <stop offset="100%" stop-color="#FF5500" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#favBg)" />
  <!-- Dynamic V Air Stream -->
  <path d="M 32 46 L 64 96 L 96 46" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="96" cy="46" r="6" fill="#FFFFFF" />
  <!-- Swirl loop -->
  <path d="M 38 78 C 30 92, 48 100, 64 100 C 90 100, 104 84, 104 64" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="7" stroke-linecap="round" />
</svg>
`;

async function generate() {
  console.log('Writing vector SVGs...');
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg.trim());

  console.log('Generating raster PWA PNG icons with sharp...');
  const svgBuffer = Buffer.from(iconSvg);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // Apple touch icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Android maskable 512x512 (with padding safe-zone for adaptive icon crop)
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#FF7A00',
    })
    .png()
    .toFile(path.join(publicDir, 'maskable-icon.png'));

  // Android Native App Icons (mipmap)
  const androidResDir = path.resolve('android/app/src/main/res');
  if (fs.existsSync(androidResDir)) {
    const androidSizes = [
      { folder: 'mipmap-mdpi', size: 48 },
      { folder: 'mipmap-hdpi', size: 72 },
      { folder: 'mipmap-xhdpi', size: 96 },
      { folder: 'mipmap-xxhdpi', size: 144 },
      { folder: 'mipmap-xxxhdpi', size: 192 },
    ];

    for (const { folder, size } of androidSizes) {
      const targetDir = path.join(androidResDir, folder);
      if (fs.existsSync(targetDir)) {
        await sharp(svgBuffer).resize(size, size).png().toFile(path.join(targetDir, 'ic_launcher.png'));
        await sharp(svgBuffer).resize(size, size).png().toFile(path.join(targetDir, 'ic_launcher_round.png'));
        await sharp(svgBuffer).resize(size, size).png().toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
      }
    }
    console.log('Android mipmap icons updated successfully!');
  }

  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
