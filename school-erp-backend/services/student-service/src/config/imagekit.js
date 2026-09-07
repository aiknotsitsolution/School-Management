const ImageKit = require("imagekit");

const requiredConfig = [
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
];

const getImageKit = () => {
  const missing = requiredConfig.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `ImageKit is not configured. Missing: ${missing.join(", ")}`,
    );
  }

  return new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
};

module.exports = getImageKit;
