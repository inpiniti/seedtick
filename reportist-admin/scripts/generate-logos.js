const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public');
const rootDir = path.join(__dirname, '..', '..');

// 1. 기본 둥근 사각형 (기존 apple-icon.svg 기반 그대로 120x120)
const svgRounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="120" height="120">
  <rect width="180" height="180" rx="40" fill="#0f172a" />
  <g transform="rotate(45 90 90)">
    <rect x="70" y="28" width="40" height="124" rx="20" fill="none" stroke="#ffffff" stroke-width="12" stroke-linejoin="round" />
    <path d="M 70 68 L 70 48 C 70 36.95 78.95 28 90 28 C 101.05 28 110 36.95 110 48 L 110 68 Z" fill="#ffffff" />
  </g>
</svg>`;

// 2. 사각형 꽉 찬 배경 (구글이 자체적으로 동그랗게 자르거나 테두리를 줄 때 잘림 없이 가장 안정적)
const svgFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="120" height="120">
  <rect width="180" height="180" fill="#0f172a" />
  <g transform="rotate(45 90 90)">
    <rect x="70" y="28" width="40" height="124" rx="20" fill="none" stroke="#ffffff" stroke-width="12" stroke-linejoin="round" />
    <path d="M 70 68 L 70 48 C 70 36.95 78.95 28 90 28 C 101.05 28 110 36.95 110 48 L 110 68 Z" fill="#ffffff" />
  </g>
</svg>`;

// 3. 원형 배경 (구글 동의 화면이 원형 마스크일 때 대비)
const svgCircle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="120" height="120">
  <circle cx="90" cy="90" r="90" fill="#0f172a" />
  <g transform="rotate(45 90 90)">
    <rect x="70" y="28" width="40" height="124" rx="20" fill="none" stroke="#ffffff" stroke-width="12" stroke-linejoin="round" />
    <path d="M 70 68 L 70 48 C 70 36.95 78.95 28 90 28 C 101.05 28 110 36.95 110 48 L 110 68 Z" fill="#ffffff" />
  </g>
</svg>`;

async function main() {
  const targets = [
    { name: 'reportist-logo-120x120.png', svg: svgRounded, desc: '기본 둥근 사각형 (120x120)' },
    { name: 'reportist-logo-fill-120x120.png', svg: svgFull, desc: '배경 채움 사각형 (120x120 - 구글 동의 화면 추천)' },
    { name: 'reportist-logo-circle-120x120.png', svg: svgCircle, desc: '원형 배경 (120x120)' }
  ];

  for (const item of targets) {
    const buf = Buffer.from(item.svg);
    const pubPath = path.join(outputDir, item.name);
    const rootPath = path.join(rootDir, item.name);

    await sharp(buf).resize(120, 120).png().toFile(pubPath);
    await sharp(buf).resize(120, 120).png().toFile(rootPath);
    console.log(`Generated: ${item.name} (${item.desc})`);
  }
}

main().catch(console.error);
