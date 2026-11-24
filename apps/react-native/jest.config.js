module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: ['module:@react-native/babel-preset'],
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/'],
};
