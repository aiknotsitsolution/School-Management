const { getPermissionsFor } = require("../utils/permissions");
const { assertAcademicRefs } = require("./assertAcademicRefs");

// ---------------------------------------------------------------------------
// Platform-wide master-data factory.
//
// A master is a small, tenant-scoped catalog the platform lets an admin fill
// (exam types, classes, sections, subjects, time slots, rooms, ...). This
// module provides the CRUD skeleton so every service exposes identical
// semantics instead of re-implementing tenancy, duplicate detection and
// seed-on-empty per service.
//
// See README.md in this folder for the classification rules.
// ---------------------------------------------------------------------------

// Matches academic-service models' storage convention: lowercase, collapse
// whitespace, trim. Kept here so custom dup/seeds logic stays consistent.
const clean = (value) => String(value || "").trim();

const normalizeKey = (name) => clean(name).toLowerCase().replace(/\s+/g, " ").trim();

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Builds { list, getById, create, deactivate } for a kind registry.
//
// config = {
//   kinds: { kind: kindConfig, ... },  // required
//   readPermission, writePermission,   // required permission strings
// }
//
// kindConfig = {
//   label: string,                          // human label for messages
//   model: Model,                           // mongoose model
//   sort: object,                           // list sort
//   build(payload) -> doc fields,           // validate + shape (throw httpError(400))
//   dupFilter(payload) -> filter,           // plain masters: duplicate search
//   seeds() -> rows,                        // per-school defaults (seed on empty list)
//   dualScope: bool,                        // subjects-style: global + tenant rows
//   dupQuery(payload) -> filter,            // dualScope only: cross-scope dup search
//   listDualScope({ req, canWrite }) -> rows, // dualScope only: full list override
//   globalSeeds() -> rows,                  // dualScope only: platform rows seeded once
// }
// ---------------------------------------------------------------------------
function createMasterController(config) {
  const { kinds, readPermission, writePermission } = config;

  const canWrite = (user) => getPermissionsFor(user).includes(writePermission);

  async function seedDefaults(ctx, schoolId) {
    const docs = await ctx.model.countDocuments({ schoolId });
    if (docs > 0) return false;
    const rows = (ctx.seeds ? ctx.seeds() : []).map((row) => ({ ...row, schoolId }));
    if (rows.length) await ctx.model.insertMany(rows);
    return true;
  }

  // Seeds the platform-level (scope:"global") rows exactly once.
  async function seedGlobal(ctx) {
    if (!ctx.dualScope || !ctx.globalSeeds) return false;
    const count = await ctx.model.countDocuments({ scope: "global" });
    if (count > 0) return false;
    const rows = ctx.globalSeeds().map((row) => ({
      ...row,
      scope: "global",
    }));
    if (rows.length) await ctx.model.insertMany(rows);
    return true;
  }

  async function list(req, res, next) {
    try {
      const ctx = kinds[req.params.kind];
      if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

      if (ctx.dualScope) {
        await seedGlobal(ctx).catch(() => {});
        let rows = [];
        if (ctx.listDualScope) {
          rows = await ctx.listDualScope({ req, canWrite: canWrite(req.user) });
        } else {
          rows = await ctx.model
            .find({
              status: "active",
              $or: [{ scope: "global" }, { scope: "tenant", schoolId: req.tenantId }],
            })
            .sort(ctx.sort)
            .lean();
        }
        return res.json({ success: true, count: rows.length, data: rows });
      }

      let docs = await ctx.model.find({ schoolId: req.tenantId, active: true }).sort(ctx.sort).lean();
      if (docs.length === 0 && canWrite(req.user) && (await seedDefaults(ctx, req.tenantId))) {
        docs = await ctx.model.find({ schoolId: req.tenantId, active: true }).sort(ctx.sort).lean();
      }
      res.json({ success: true, count: docs.length, data: docs });
    } catch (err) {
      next(err);
    }
  }

  async function getById(req, res, next) {
    try {
      const ctx = kinds[req.params.kind];
      if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

      const filter = { _id: req.params.id };
      if (ctx.dualScope) {
        filter.$or = [{ scope: "global" }, { scope: "tenant", schoolId: req.tenantId }];
      } else {
        filter.schoolId = req.tenantId;
      }
      const doc = await ctx.model.findOne(filter).lean();
      if (!doc) return res.status(404).json({ success: false, message: `${ctx.label} not found` });
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  async function create(req, res, next) {
    try {
      const ctx = kinds[req.params.kind];
      if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

      const payload = ctx.build(req.body || {});

      if (ctx.dualScope) {
        // Always created as tenant-scoped. Duplicate check spans the global
        // library and this school's tenant subjects.
        const dup = ctx.dupQuery ? ctx.dupQuery(payload) : {};
        const existing = await ctx.model
          .findOne({
            $or: [
              { scope: "global", ...dup },
              { scope: "tenant", schoolId: req.tenantId, ...dup },
            ],
          })
          .lean();
        if (existing) {
          const label = existing.scope === "global"
            ? (ctx.globalScopeLabel || "Global subject")
            : (ctx.tenantScopeLabel || "Subject");
          return res.status(409).json({
            success: false,
            message: `${label} "${existing.name}" already exists`,
            data: { existingId: existing._id, name: existing.name, scope: existing.scope },
          });
        }
        const doc = await ctx.model.create({
          ...payload,
          scope: "tenant",
          schoolId: req.tenantId,
          tenantId: req.tenantId,
          createdBy: req.user?._id || req.user?.id || null,
        });
        return res.status(201).json({ success: true, data: doc });
      }

      const dupFilter = ctx.dupFilter ? ctx.dupFilter(payload) : null;
      if (dupFilter) {
        const existing = await ctx.model.findOne({ schoolId: req.tenantId, ...dupFilter }).lean();
        if (existing) {
          return res.status(409).json({
            success: false,
            message: `${ctx.label} "${payload.name || payload.label}" already exists for this school`,
          });
        }
      }

      const doc = await ctx.model.create({ ...payload, schoolId: req.tenantId });
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      if (err && err.status) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      if (err && err.code === 11000) {
        return res.status(409).json({ success: false, message: "This value already exists for this school" });
      }
      if (err && err.name === "ValidationError") {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async function deactivate(req, res, next) {
    try {
      const ctx = kinds[req.params.kind];
      if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

      // Only tenant-scoped master rows can be deactivated; global rows are
      // immutable by tenants.
      const filter = { _id: req.params.id };
      if (ctx.dualScope) {
        filter.scope = "tenant";
        filter.schoolId = req.tenantId;
      } else {
        filter.schoolId = req.tenantId;
      }
      // Subjects use status:"inactive"; other masters use active:false.
      const update = ctx.dualScope ? { status: "inactive" } : { active: false };
      const doc = await ctx.model.findOneAndUpdate(filter, update, { new: true }).lean();
      if (!doc) return res.status(404).json({ success: false, message: `${ctx.label} not found` });
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  return { list, getById, create, deactivate };
}

module.exports = { createMasterController, httpError, clean, normalizeKey, assertAcademicRefs };