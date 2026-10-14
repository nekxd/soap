const fs = require('fs');

function zipalign(inPath, outPath, alignment = 4) {
  const buf = fs.readFileSync(inPath);
  
  // Find End of Central Directory (EOCD)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('EOCD signature not found');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  // Read Central Directory entries
  const cdEntries = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`Central directory signature not found at offset ${p}`);
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const fnLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const fn = buf.toString('utf8', p + 46, p + 46 + fnLen);
    const cdEntryLen = 46 + fnLen + extraLen + commentLen;
    const cdData = Buffer.from(buf.subarray(p, p + cdEntryLen));

    cdEntries.push({
      fn,
      method,
      compSize,
      uncompSize,
      localHeaderOffset,
      cdData
    });
    p += cdEntryLen;
  }

  // Sort by localHeaderOffset to preserve physical file order
  cdEntries.sort((a, b) => a.localHeaderOffset - b.localHeaderOffset);

  // Write new zip chunks
  const chunks = [];
  let currentOffset = 0;

  for (const entry of cdEntries) {
    const locOffset = entry.localHeaderOffset;
    if (buf.readUInt32LE(locOffset) !== 0x04034b50) {
      throw new Error(`Local header signature not found at ${locOffset} for ${entry.fn}`);
    }

    const flag = buf.readUInt16LE(locOffset + 6);
    const fnLen = buf.readUInt16LE(locOffset + 26);
    const extraLen = buf.readUInt16LE(locOffset + 28);
    const compSize = entry.compSize;
    const dataOffset = locOffset + 30 + fnLen + extraLen;

    // Check for data descriptor if bit 3 is set
    let descLen = 0;
    if ((flag & 0x08) !== 0) {
      if (buf.readUInt32LE(dataOffset + compSize) === 0x08074b50) {
        descLen = 16;
      } else {
        descLen = 12;
      }
    }

    const payload = buf.subarray(dataOffset, dataOffset + compSize + descLen);
    const fileNameBytes = buf.subarray(locOffset + 30, locOffset + 30 + fnLen);
    const origExtraBytes = buf.subarray(locOffset + 30 + fnLen, dataOffset);

    let padding = 0;
    if (entry.method === 0) {
      // Uncompressed: ensure (currentOffset + 30 + fnLen + extraLen + padding) % alignment === 0
      const baseOffset = currentOffset + 30 + fnLen + extraLen;
      const rem = baseOffset % alignment;
      if (rem !== 0) {
        padding = alignment - rem;
      }
    }

    const newExtraLen = extraLen + padding;
    const newHeader = Buffer.from(buf.subarray(locOffset, locOffset + 30));
    newHeader.writeUInt16LE(newExtraLen, 28);

    entry.newLocalHeaderOffset = currentOffset;

    chunks.push(newHeader);
    chunks.push(fileNameBytes);
    chunks.push(origExtraBytes);
    if (padding > 0) {
      chunks.push(Buffer.alloc(padding, 0));
    }
    chunks.push(payload);

    currentOffset += (30 + fnLen + newExtraLen + compSize + descLen);
  }

  // Write Central Directory
  const newCdOffset = currentOffset;
  for (const entry of cdEntries) {
    const cd = Buffer.from(entry.cdData);
    cd.writeUInt32LE(entry.newLocalHeaderOffset, 42);
    chunks.push(cd);
    currentOffset += cd.length;
  }

  const newCdSize = currentOffset - newCdOffset;

  // Write EOCD
  const eocd = Buffer.from(buf.subarray(eocdOffset));
  eocd.writeUInt32LE(newCdSize, 12);
  eocd.writeUInt32LE(newCdOffset, 16);
  chunks.push(eocd);

  const outBuf = Buffer.concat(chunks);
  fs.writeFileSync(outPath, outBuf);
}

module.exports = { zipalign };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node zipalign.js <in.apk> <out.apk> [align]');
    process.exit(1);
  }
  zipalign(args[0], args[1], parseInt(args[2] || '4', 10));
  console.log('Zipalign completed successfully:', args[1]);
}
