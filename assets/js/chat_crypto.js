/**
 * Чат@Mail.Ru - Модуль шифрования AES-256-CBC + SHA-256
 * 100% чистый JavaScript без сторонних зависимостей.
 * Работает в Node.js и любых браузерах (включая Android 1.6 и HTTP-окружение).
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChatCrypto = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // --- 1. SHA-256 Implementation ---
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256Bytes(bytes) {
    var maxWord = Math.pow(2, 32);
    var words = [];
    var bitLength = bytes.length * 8;
    for (var i = 0; i < bytes.length; i++) {
      words[i >> 2] |= bytes[i] << ((3 - (i % 4)) * 8);
    }
    // Padding
    words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8);
    var wordCount = ((bytes.length + 8) >> 6) + 1;
    while (words.length < wordCount * 16 - 2) {
      words.push(0);
    }
    words.push((bitLength / maxWord) | 0);
    words.push(bitLength | 0);

    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    var w = new Array(64);
    for (var j = 0; j < words.length; j += 16) {
      for (var t = 0; t < 16; t++) w[t] = words[j + t] | 0;
      for (var t = 16; t < 64; t++) {
        var s0 = (rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3));
        var s1 = (rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10));
        w[t] = (((w[t - 16] + s0) | 0) + ((w[t - 7] + s1) | 0)) | 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var t = 0; t < 64; t++) {
        var S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25));
        var ch = (e & f) ^ ((~e) & g);
        var temp1 = ((((h + S1) | 0) + ch) | 0) + ((K[t] + w[t]) | 0);
        var S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    var out = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      out[i * 4]     = (H[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
      out[i * 4 + 3] = H[i] & 0xff;
    }
    return out;
  }

  function sha256Hex(strOrBytes) {
    var b = typeof strOrBytes === 'string' ? utf8ToBytes(strOrBytes) : strOrBytes;
    var hash = sha256Bytes(b);
    return bytesToHex(hash);
  }

  // --- 2. AES-256 Engine ---
  var SBOX = new Uint8Array(256), INV_SBOX = new Uint8Array(256);
  (function initSbox() {
    var p = 1, q = 1;
    do {
      p = p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0);
      q ^= q << 1; q ^= q << 2; q ^= q << 4; q ^= q & 0x80 ? 0x09 : 0;
      q &= 0xff;
      var xformed = q ^ ((q << 1) | (q >>> 7)) ^ ((q << 2) | (q >>> 6)) ^ ((q << 3) | (q >>> 5)) ^ ((q << 4) | (q >>> 4));
      xformed = (xformed ^ 0x63) & 0xff;
      SBOX[p] = xformed;
      INV_SBOX[xformed] = p;
    } while (p !== 1);
    SBOX[0] = 0x63; INV_SBOX[0x63] = 0;
  })();

  var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function keyExpansion(key) {
    var w = new Uint32Array(60);
    for (var i = 0; i < 8; i++) {
      w[i] = (key[4*i] << 24) | (key[4*i+1] << 16) | (key[4*i+2] << 8) | key[4*i+3];
    }
    for (var i = 8; i < 60; i++) {
      var temp = w[i - 1];
      if (i % 8 === 0) {
        temp = ((SBOX[(temp >>> 16) & 0xff] << 24) |
                (SBOX[(temp >>> 8) & 0xff] << 16) |
                (SBOX[temp & 0xff] << 8) |
                SBOX[(temp >>> 24) & 0xff]) ^ (RCON[i / 8] << 24);
      } else if (i % 8 === 4) {
        temp = (SBOX[(temp >>> 24) & 0xff] << 24) |
               (SBOX[(temp >>> 16) & 0xff] << 16) |
               (SBOX[(temp >>> 8) & 0xff] << 8) |
               SBOX[temp & 0xff];
      }
      w[i] = (w[i - 8] ^ temp) >>> 0;
    }
    return w;
  }

  function xtime(x) { return ((x << 1) ^ (((x >>> 7) & 1) * 0x11b)) & 0xff; }
  function mul(a, b) {
    var res = 0;
    for (var i = 0; i < 8; i++) {
      if ((b & (1 << i)) !== 0) {
        var temp = a;
        for (var j = 0; j < i; j++) temp = xtime(temp);
        res ^= temp;
      }
    }
    return res;
  }

  function mixColumns(s) {
    for (var c = 0; c < 4; c++) {
      var a = s[c*4], b = s[c*4+1], d = s[c*4+2], e = s[c*4+3];
      s[c*4]   = xtime(a ^ b) ^ b ^ d ^ e;
      s[c*4+1] = xtime(b ^ d) ^ d ^ e ^ a;
      s[c*4+2] = xtime(d ^ e) ^ e ^ a ^ b;
      s[c*4+3] = xtime(e ^ a) ^ a ^ b ^ d;
    }
  }

  function invMixColumns(s) {
    for (var c = 0; c < 4; c++) {
      var a = s[c*4], b = s[c*4+1], d = s[c*4+2], e = s[c*4+3];
      s[c*4]   = mul(a, 0x0e) ^ mul(b, 0x0b) ^ mul(d, 0x0d) ^ mul(e, 0x09);
      s[c*4+1] = mul(a, 0x09) ^ mul(b, 0x0e) ^ mul(d, 0x0b) ^ mul(e, 0x0d);
      s[c*4+2] = mul(a, 0x0d) ^ mul(b, 0x09) ^ mul(d, 0x0e) ^ mul(e, 0x0b);
      s[c*4+3] = mul(a, 0x0b) ^ mul(b, 0x0d) ^ mul(d, 0x09) ^ mul(e, 0x0e);
    }
  }

  function encryptBlock(block, w) {
    var s = new Uint8Array(block);
    for (var c = 0; c < 4; c++) {
      var wc = w[c];
      s[c*4]   ^= (wc >>> 24) & 0xff;
      s[c*4+1] ^= (wc >>> 16) & 0xff;
      s[c*4+2] ^= (wc >>> 8) & 0xff;
      s[c*4+3] ^= wc & 0xff;
    }
    for (var r = 1; r <= 13; r++) {
      for (var i = 0; i < 16; i++) s[i] = SBOX[s[i]];
      var t;
      t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
      t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
      mixColumns(s);
      for (var c = 0; c < 4; c++) {
        var wc = w[r*4 + c];
        s[c*4]   ^= (wc >>> 24) & 0xff;
        s[c*4+1] ^= (wc >>> 16) & 0xff;
        s[c*4+2] ^= (wc >>> 8) & 0xff;
        s[c*4+3] ^= wc & 0xff;
      }
    }
    for (var i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    var t;
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
    for (var c = 0; c < 4; c++) {
      var wc = w[14*4 + c];
      s[c*4]   ^= (wc >>> 24) & 0xff;
      s[c*4+1] ^= (wc >>> 16) & 0xff;
      s[c*4+2] ^= (wc >>> 8) & 0xff;
      s[c*4+3] ^= wc & 0xff;
    }
    return s;
  }

  function decryptBlock(block, w) {
    var s = new Uint8Array(block);
    for (var c = 0; c < 4; c++) {
      var wc = w[14*4 + c];
      s[c*4]   ^= (wc >>> 24) & 0xff;
      s[c*4+1] ^= (wc >>> 16) & 0xff;
      s[c*4+2] ^= (wc >>> 8) & 0xff;
      s[c*4+3] ^= wc & 0xff;
    }
    for (var r = 13; r >= 1; r--) {
      var t;
      t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
      t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
      for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
      for (var c = 0; c < 4; c++) {
        var wc = w[r*4 + c];
        s[c*4]   ^= (wc >>> 24) & 0xff;
        s[c*4+1] ^= (wc >>> 16) & 0xff;
        s[c*4+2] ^= (wc >>> 8) & 0xff;
        s[c*4+3] ^= wc & 0xff;
      }
      invMixColumns(s);
    }
    var t;
    t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
    t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
    for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    for (var c = 0; c < 4; c++) {
      var wc = w[c];
      s[c*4]   ^= (wc >>> 24) & 0xff;
      s[c*4+1] ^= (wc >>> 16) & 0xff;
      s[c*4+2] ^= (wc >>> 8) & 0xff;
      s[c*4+3] ^= wc & 0xff;
    }
    return s;
  }

  // --- 3. Encoding Helpers ---
  function utf8ToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      } else {
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      }
    }
    return new Uint8Array(utf8);
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes);
    }
    var out = '', i = 0;
    while (i < bytes.length) {
      var c = bytes[i++];
      if (c > 127) {
        if (c > 191 && c < 224) {
          c = ((c & 31) << 6) | (bytes[i++] & 63);
        } else if (c > 223 && c < 240) {
          c = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        } else if (c > 239 && c < 248) {
          c = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        }
      }
      out += String.fromCharCode(c);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i].toString(16);
      hex += (b.length === 1 ? '0' : '') + b;
    }
    return hex;
  }

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  function bytesToBase64(bytes) {
    var out = '';
    var i = 0;
    while (i < bytes.length) {
      var b1 = bytes[i++];
      var b2 = i < bytes.length ? bytes[i++] : NaN;
      var b3 = i < bytes.length ? bytes[i++] : NaN;
      var e1 = b1 >> 2;
      var e2 = ((b1 & 3) << 4) | (b2 >> 4);
      var e3 = ((b2 & 15) << 2) | (b3 >> 6);
      var e4 = b3 & 63;
      if (isNaN(b2)) { e3 = e4 = 64; }
      else if (isNaN(b3)) { e4 = 64; }
      out += B64_CHARS.charAt(e1) + B64_CHARS.charAt(e2) + B64_CHARS.charAt(e3) + B64_CHARS.charAt(e4);
    }
    return out;
  }

  function base64ToBytes(b64) {
    b64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
    var bytes = [];
    var i = 0;
    while (i < b64.length) {
      var e1 = B64_CHARS.indexOf(b64.charAt(i++));
      var e2 = B64_CHARS.indexOf(b64.charAt(i++));
      var e3 = B64_CHARS.indexOf(b64.charAt(i++));
      var e4 = B64_CHARS.indexOf(b64.charAt(i++));
      var b1 = (e1 << 2) | (e2 >> 4);
      var b2 = ((e2 & 15) << 4) | (e3 >> 2);
      var b3 = ((e3 & 3) << 6) | e4;
      bytes.push(b1);
      if (e3 !== 64) bytes.push(b2);
      if (e4 !== 64) bytes.push(b3);
    }
    return new Uint8Array(bytes);
  }

  function randomBytes(n) {
    var arr = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < n; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
    }
    return arr;
  }

  // Key derivation using iterative SHA-256 (PBKDF2-like)
  function deriveKey(password, saltBytes) {
    var pwBytes = utf8ToBytes(password);
    var combined = new Uint8Array(pwBytes.length + saltBytes.length);
    combined.set(pwBytes);
    combined.set(saltBytes, pwBytes.length);
    var key = sha256Bytes(combined);
    // 500 rounds of SHA-256
    for (var r = 0; r < 500; r++) {
      key = sha256Bytes(key);
    }
    return key;
  }

  // --- 4. High-Level API (Encrypt & Decrypt) ---
  function encryptData(plainTextOrObj, password) {
    var text = typeof plainTextOrObj === 'string' ? plainTextOrObj : JSON.stringify(plainTextOrObj, null, 2);
    var plainBytes = utf8ToBytes(text);

    // PKCS7 padding
    var padLen = 16 - (plainBytes.length % 16);
    var padded = new Uint8Array(plainBytes.length + padLen);
    padded.set(plainBytes);
    for (var i = plainBytes.length; i < padded.length; i++) padded[i] = padLen;

    var salt = randomBytes(16);
    var iv = randomBytes(16);
    var key = deriveKey(password, salt);
    var w = keyExpansion(key);

    var cipherBytes = new Uint8Array(padded.length);
    var prevBlock = new Uint8Array(iv);

    for (var i = 0; i < padded.length; i += 16) {
      var block = padded.subarray(i, i + 16);
      var xored = new Uint8Array(16);
      for (var k = 0; k < 16; k++) xored[k] = block[k] ^ prevBlock[k];
      var encBlock = encryptBlock(xored, w);
      cipherBytes.set(encBlock, i);
      prevBlock.set(encBlock);
    }

    var b64Cipher = bytesToBase64(cipherBytes);
    var checksum = sha256Hex(plainBytes);

    // Format output as clean encrypted .txt file
    var lines = [];
    lines.push('# ====================================================================');
    lines.push('# ЧАТ@MAIL.RU - ЗАШИФРОВАННАЯ БАЗА ДАННЫХ (ENCRYPTED DATABASE)');
    lines.push('# ВНИМАНИЕ: Все сообщения, пользователи и настройки зашифрованы AES-256');
    lines.push('# ====================================================================');
    lines.push('-----BEGIN ENCRYPTED CHAT DATABASE-----');
    lines.push('FORMAT: AES-256-CBC');
    lines.push('SALT: ' + bytesToHex(salt));
    lines.push('IV: ' + bytesToHex(iv));
    lines.push('CHECKSUM: ' + checksum);
    lines.push('UPDATED: ' + new Date().toISOString());
    lines.push('CIPHERTEXT:');
    for (var i = 0; i < b64Cipher.length; i += 64) {
      lines.push(b64Cipher.substr(i, 64));
    }
    lines.push('-----END ENCRYPTED CHAT DATABASE-----');
    return lines.join('\n');
  }

  function decryptData(encryptedFileText, password) {
    if (!encryptedFileText) throw new Error('Пустой файл зашифрованной базы данных');
    var saltMatch = encryptedFileText.match(/SALT:\s*([a-fA-F0-9]+)/);
    var ivMatch = encryptedFileText.match(/IV:\s*([a-fA-F0-9]+)/);
    var chkMatch = encryptedFileText.match(/CHECKSUM:\s*([a-fA-F0-9]+)/);
    if (!saltMatch || !ivMatch) {
      throw new Error('Некорректный формат зашифрованного файла (отсутствуют SALT/IV)');
    }

    var salt = hexToBytes(saltMatch[1]);
    var iv = hexToBytes(ivMatch[1]);
    var expectedChecksum = chkMatch ? chkMatch[1].toLowerCase() : null;

    var startIdx = encryptedFileText.indexOf('CIPHERTEXT:');
    if (startIdx === -1) throw new Error('Блок CIPHERTEXT не найден');
    var endIdx = encryptedFileText.indexOf('-----END ENCRYPTED', startIdx);
    var b64Data = (endIdx !== -1 ? encryptedFileText.substring(startIdx + 11, endIdx) : encryptedFileText.substring(startIdx + 11)).replace(/\s+/g, '');

    var cipherBytes = base64ToBytes(b64Data);
    if (cipherBytes.length % 16 !== 0) {
      throw new Error('Размер зашифрованных данных не кратен 16 байтам');
    }

    var key = deriveKey(password, salt);
    var w = keyExpansion(key);

    var plainBytes = new Uint8Array(cipherBytes.length);
    var prevBlock = new Uint8Array(iv);

    for (var i = 0; i < cipherBytes.length; i += 16) {
      var encBlock = cipherBytes.subarray(i, i + 16);
      var decBlock = decryptBlock(encBlock, w);
      for (var k = 0; k < 16; k++) {
        plainBytes[i + k] = decBlock[k] ^ prevBlock[k];
      }
      prevBlock.set(encBlock);
    }

    // Remove PKCS7 padding
    var padLen = plainBytes[plainBytes.length - 1];
    if (padLen < 1 || padLen > 16) {
      throw new Error('Неверный пароль или поврежденные данные (ошибка PKCS7 padding)');
    }
    for (var i = plainBytes.length - padLen; i < plainBytes.length; i++) {
      if (plainBytes[i] !== padLen) {
        throw new Error('Неверный пароль или поврежденные данные (несовпадение padding)');
      }
    }

    var unpadded = plainBytes.subarray(0, plainBytes.length - padLen);
    if (expectedChecksum) {
      var actualChecksum = sha256Hex(unpadded);
      if (actualChecksum !== expectedChecksum) {
        throw new Error('Контрольная сумма CHECKSUM не совпадает! Неверный ключ или данные изменены.');
      }
    }

    return bytesToUtf8(unpadded);
  }

  return {
    encrypt: encryptData,
    decrypt: decryptData,
    sha256: sha256Hex
  };
}));
