const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const javaExe = 'C:/Users/yandhiev/.p2/pool/plugins/org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_25.0.4.v20260826-0822/jre/bin/java.exe';
const javacExe = 'C:/Users/yandhiev/.p2/pool/plugins/org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_25.0.4.v20260826-0822/jre/bin/javac.exe';
const jarsignerExe = 'C:/Users/yandhiev/.p2/pool/plugins/org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_25.0.4.v20260826-0822/jre/bin/jarsigner.exe';
const keytoolExe = 'C:/Users/yandhiev/.p2/pool/plugins/org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_25.0.4.v20260826-0822/jre/bin/keytool.exe';

console.log('1. Compiling Java sources...');
fs.mkdirSync('android/bin/classes', { recursive: true });
execSync(`"${javacExe}" -source 8 -target 8 -cp "android/libs/android.jar" -d "android/bin/classes" "android/gen/ru/mail/client2010/R.java" "android/src/ru/mail/client2010/Constants.java" "android/src/ru/mail/client2010/WebHelper.java" "android/src/ru/mail/client2010/MainActivity.java"`, { stdio: 'inherit' });

console.log('2. Converting bytecode to classes.dex...');
execSync(`"${javaExe}" -cp "android/dx.jar" com.android.dx.command.Main --dex --output="android/bin/classes.dex" "android/bin/classes"`, { stdio: 'inherit' });

console.log('3. Preparing APK build staging folder...');
const bDir = path.resolve('android/apk_build');
if (fs.existsSync(bDir)) fs.rmSync(bDir, { recursive: true, force: true });
fs.mkdirSync(bDir, { recursive: true });

fs.copyFileSync('android/AndroidManifest.xml', path.join(bDir, 'AndroidManifest.xml'));

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(item => {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  });
}
copyDir('android/res', path.join(bDir, 'res'));
fs.copyFileSync('android/bin/classes.dex', path.join(bDir, 'classes.dex'));

const yml = `version: 2.9.3
apkFileName: MailRu2010.apk
isFrameworkApk: false
usesFramework:
  ids:
  - 1
sdkInfo:
  minSdkVersion: '4'
  targetSdkVersion: '34'
packageInfo:
  forcedPackageId: '127'
versionInfo:
  versionCode: '1'
  versionName: '1.0'
doNotCompress:
- arsc
- png
- gif
`;
fs.writeFileSync(path.join(bDir, 'apktool.yml'), yml);

console.log('4. Building APK package with apktool...');
const outApk = path.resolve('android/bin/MailRu2010.apk');
if (fs.existsSync(outApk)) fs.unlinkSync(outApk);
execSync(`"${javaExe}" -jar android/apktool.jar b android/apk_build -o "${outApk}"`, { stdio: 'inherit' });

console.log('5. Signing APK for Android 1.6 to 16 compatibility...');
const keystorePath = path.resolve('android/debug.keystore');
if (!fs.existsSync(keystorePath)) {
  execSync(`"${keytoolExe}" -genkey -v -keystore "${keystorePath}" -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`, { stdio: 'inherit' });
}

execSync(`"${jarsignerExe}" -sigalg SHA1withRSA -digestalg SHA1 -keystore "${keystorePath}" -storepass android -keypass android "${outApk}" androiddebugkey`, { stdio: 'inherit' });

// Clean staging folder
if (fs.existsSync(bDir)) fs.rmSync(bDir, { recursive: true, force: true });

console.log('SUCCESS! Signed APK created at:', outApk, 'Size:', fs.statSync(outApk).size, 'bytes');

// Copy signed APK to root or downloadable location
fs.copyFileSync(outApk, 'MailRu2010.apk');
console.log('Copied to root: MailRu2010.apk');

// Also copy to eclipse-workspace
fs.copyFileSync(outApk, 'C:/Users/yandhiev/eclipse-workspace/MailRu2010/MailRu2010.apk');
console.log('Copied to C:/Users/yandhiev/eclipse-workspace/MailRu2010/MailRu2010.apk');
