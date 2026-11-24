const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

// Hash long C++ object paths before Ninja reaches the Windows path limit.
module.exports = (config) => {
  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('// navigation: Windows CMake version')) {
      mod.modResults.contents = `// navigation: Windows CMake version\nsubprojects { p ->\n    p.plugins.withId('com.android.library') { p.android.externalNativeBuild.cmake.version = "3.31.6" }\n    p.plugins.withId('com.android.application') { p.android.externalNativeBuild.cmake.version = "3.31.6" }\n}\n` + mod.modResults.contents;
    }
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
  const marker = '// navigation: short Windows CMake object paths';
  if (!mod.modResults.contents.includes(marker)) {
    mod.modResults.contents += `\n${marker}\nandroid.defaultConfig.externalNativeBuild.cmake.arguments.add("-DCMAKE_OBJECT_PATH_MAX=240")\n`;
  }
  return mod;
  });
};
