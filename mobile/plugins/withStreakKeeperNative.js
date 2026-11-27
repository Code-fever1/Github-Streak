const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'native-android', 'app', 'src', 'main');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/** Copies tracked Veyon native Kotlin + root shell assets into the prebuild android tree. */
function withStreakKeeperNative(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidMain = path.join(projectRoot, 'android', 'app', 'src', 'main');
      const kotlinSrc = path.join(SRC, 'java', 'com', 'streakkeeper', 'mobile');
      const kotlinDest = path.join(androidMain, 'java', 'com', 'streakkeeper', 'mobile');
      const assetsSrc = path.join(SRC, 'assets');
      const assetsDest = path.join(androidMain, 'assets');

      copyDir(kotlinSrc, kotlinDest);
      copyDir(assetsSrc, assetsDest);
      return cfg;
    },
  ]);
}

module.exports = withStreakKeeperNative;
