const MIN_JWT_SECRET_LENGTH = 32;

// JWT_SECRET contract: read only from the environment, no fallback, validated
// at module load so the service fails closed on misconfiguration. Every
// service carries a copy of this file (matching middleware/auth.js and
// utils/permissions.js); consolidating into a shared package is P0-R2.
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `[jwt] JWT_SECRET must be set in the environment and be at least ${MIN_JWT_SECRET_LENGTH} characters long. Refusing to start.`
    );
  }
  return secret;
};

module.exports = { MIN_JWT_SECRET_LENGTH, getJwtSecret };