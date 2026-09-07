const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");

const utilResolved = require.resolve("../src/utils/jwtSecret");
const genResolved = require.resolve("../src/utils/generateToken");

let getJwtSecret;
let MIN_JWT_SECRET_LENGTH;

const setSecret = (value) => {
  if (value === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = value;
  }
};

// utils/jwtSecret reads process.env.JWT_SECRET at call time; grab a fresh
// binding once here instead of per case.
const loadUtil = () => {
  const mod = require(utilResolved);
  getJwtSecret = mod.getJwtSecret;
  MIN_JWT_SECRET_LENGTH = mod.MIN_JWT_SECRET_LENGTH;
};

test("missing JWT_SECRET -> getJwtSecret throws", () => {
  loadUtil();
  setSecret(undefined);
  assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
});

test("JWT_SECRET shorter than 32 chars -> getJwtSecret throws", () => {
  setSecret("short-secret");
  assert.throws(() => getJwtSecret(), /at least 32 characters/);
});

test("JWT_SECRET of exactly 32 chars -> accepted", () => {
  setSecret("a".repeat(32));
  assert.strictEqual(MIN_JWT_SECRET_LENGTH, 32);
  assert.strictEqual(getJwtSecret(), "a".repeat(32));
});

test("access + refresh signing round-trips with a valid secret", () => {
  setSecret("b".repeat(48));
  const { generateAccessToken, generateRefreshToken } = require(genResolved);
  const user = { _id: "u1", role: "school_admin", schoolId: "s1", refId: null };
  const access = generateAccessToken(user);
  const refresh = generateRefreshToken(user);
  const payload = jwt.verify(access, process.env.JWT_SECRET);
  assert.strictEqual(payload.id, "u1");
  assert.strictEqual(payload.schoolId, "s1");
  const refreshPayload = jwt.verify(refresh, process.env.JWT_SECRET);
  assert.strictEqual(refreshPayload.id, "u1");
});

test("token signed with the old secret CANNOT be verified after rotation", () => {
  setSecret("c".repeat(32));
  const { generateAccessToken } = require(genResolved);
  const token = generateAccessToken({ _id: "u1", role: "staff", schoolId: "s1" });
  setSecret("d".repeat(32)); // simulate rotating the shared secret
  assert.throws(() => jwt.verify(token, process.env.JWT_SECRET), /invalid signature/);
});