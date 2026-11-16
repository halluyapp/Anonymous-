const { withAppBuildGradle, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
module.exports = function withAfterDarkVideo(config) {
  config = withAppBuildGradle(config, mod => {
    const dep = 'implementation("androidx.media3:media3-transformer:1.8.0")';
    if (!mod.modResults.contents.includes(dep)) mod.modResults.contents = mod.modResults.contents.replace('dependencies {', `dependencies {\n    ${dep}`);
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('After Dark video exporter requires Kotlin MainApplication');
    if (!mod.modResults.contents.includes('add(AfterDarkVideoPackage())')) mod.modResults.contents = mod.modResults.contents.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n              add(AfterDarkVideoPackage())');
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const source = path.join(mod.modRequest.projectRoot, 'native/video');
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/app/afterdark/mobile');
    await fs.promises.mkdir(target, { recursive: true });
    for (const name of ['AfterDarkVideoModule.kt', 'AfterDarkVideoPackage.kt']) await fs.promises.copyFile(path.join(source,name), path.join(target,name));
    return mod;
  }]);
};
