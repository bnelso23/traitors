const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Enabled = !!(
  (process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY) &&
  (process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY) &&
  (process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT)
);

const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET || process.env.BUCKET_NAME || process.env.S3_BUCKET;

let s3Client = null;
if (s3Enabled) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true, // Needed for many S3-compatible APIs
  });
}

function titleCase(str) {
  return str
    .split(' ')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function parseFilename(filename) {
  const base = filename.substring(0, filename.lastIndexOf('.'));
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  // Replace all underscores with spaces
  let cleaned = base.replace(/_/g, ' ');
  
  // Remove (MeisterDrucke-XXXXXX) pattern (case insensitive)
  cleaned = cleaned.replace(/\s*-\s*\(\s*MeisterDrucke-\d+\s*\)\s*$/i, '');
  cleaned = cleaned.replace(/\s*\(\s*MeisterDrucke-\d+\s*\)\s*$/i, '');
  
  // Clean multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Split by first occurrence of a hyphen (with spaces around it)
  const hyphenIndex = cleaned.indexOf(' - ');
  let artist = 'Unknown';
  let title = cleaned;

  if (hyphenIndex !== -1) {
    artist = cleaned.substring(0, hyphenIndex).trim();
    title = cleaned.substring(hyphenIndex + 3).trim();
  }

  // Standardize title casing
  artist = titleCase(artist);
  title = titleCase(title.replace(/-/g, ' ')); // replace dashes inside titles/artists with spaces

  // Standardize S3 file name: lowercased, alphanumeric + underscores
  const cleanArtist = artist.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const standardizedName = `${cleanArtist}_-_${cleanTitle}${ext}`;

  return {
    artist,
    title,
    standardizedName,
    ext
  };
}

async function run() {
  const paintingsDir = path.join(__dirname, '../paintings');
  if (!fs.existsSync(paintingsDir)) {
    console.error(`Paintings directory not found at: ${paintingsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(paintingsDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';
  });

  console.log(`Found ${files.length} paintings to upload.`);
  const metadata = [];

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(paintingsDir, file);
    const parsed = parseFilename(file);
    const s3Key = `paintings/${parsed.standardizedName}`;

    console.log(`[${i + 1}/${files.length}] Processing: "${file}"`);
    console.log(`    Artist: "${parsed.artist}" | Title: "${parsed.title}"`);
    console.log(`    Target S3 Key: "${s3Key}"`);

    if (s3Enabled && s3Client) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        let contentType = 'image/jpeg';
        if (parsed.ext === '.png') contentType = 'image/png';
        if (parsed.ext === '.webp') contentType = 'image/webp';

        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType
        }));
        console.log(`    Successfully uploaded to S3!`);
      } catch (err) {
        console.error(`    Error uploading to S3:`, err.message);
      }
    } else {
      console.log(`    S3 not enabled. Copying locally...`);
      const localDestDir = path.join(__dirname, 'public/paintings');
      if (!fs.existsSync(localDestDir)) {
        fs.mkdirSync(localDestDir, { recursive: true });
      }
      fs.copyFileSync(filePath, path.join(localDestDir, parsed.standardizedName));
    }

    metadata.push({
      id: `painting_${i + 1}`,
      artist: parsed.artist,
      title: parsed.title,
      filename: parsed.standardizedName,
      url: `/paintings/${parsed.standardizedName}`
    });
  }

  fs.writeFileSync(
    path.join(dataDir, 'paintings.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
  console.log(`Saved metadata list to: ${path.join(dataDir, 'paintings.json')}`);
}

run().catch(err => {
  console.error('Upload paintings execution failed:', err);
});
