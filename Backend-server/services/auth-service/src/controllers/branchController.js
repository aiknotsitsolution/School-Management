const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const { CURRENT_SUBSCRIPTION_STATUSES } = require("../models/Subscription");
const { httpError } = require("@school-erp/shared/src/master-data");
const { writeAudit } = require("../utils/audit");

// --------------------------------------------------------------------------
// Branch CRUD. Every query is scoped to req.tenantId, so a school can only ever
// see or touch its own campuses. Plan.limits.branches caps creation — `null`
// means unlimited, matching the Plan convention.
// --------------------------------------------------------------------------

const PICK_FIELDS = [
  "name",
  "code",
  "shortName",
  "contactName",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "pincode",
  "country",
  "isActive",
  "settings",
];

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// httpError only carries { status }, so the plan-cap rejection needs its own
// error shape: the Branches UI reads `code` to show the upgrade prompt and
// `data.limit` / `data.current` to render "3 of 3 branches used".
const branchLimitError = (limit, current) =>
  Object.assign(
    new Error(
      `Your plan allows ${limit} branch${limit === 1 ? "" : "es"}. Upgrade the plan to add more campuses.`,
    ),
    { status: 409, code: "BRANCH_LIMIT_REACHED", data: { limit, current } },
  );

// "  Main Campus " -> "main-campus". Codes are lowercase keys, not display text.
function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function assertUniqueCode(schoolId, code, excludeId) {
  const query = { schoolId, code };
  if (excludeId) query._id = { $ne: excludeId };
  const clash = await Branch.findOne(query).lean();
  if (clash) throw httpError(409, `Branch code "${code}" is already used by this school`);
}

// Resolves the school's plan cap on branches. Returns null when the school has
// no active subscription or the plan allows unlimited branches, so a missing
// billing record never blocks day-to-day work.
async function resolveBranchLimit(schoolId) {
  const subscription = await Subscription.findOne({
    schoolId,
    status: { $in: CURRENT_SUBSCRIPTION_STATUSES },
  })
    .select("planId")
    .sort({ createdAt: -1 })
    .lean();
  if (!subscription) return null;

  const plan = await Plan.findById(subscription.planId).select("limits").lean();
  if (!plan) return null;

  const limit = plan.limits?.branches;
  return typeof limit === "number" && Number.isFinite(limit) ? limit : null;
}

const listBranches = async (req, res) => {
  try {
    const includeInactive = req.query.all === "1" || req.query.all === "true";
    const filter = { schoolId: req.tenantId, isDeleted: false };
    if (!includeInactive) filter.isActive = true;

    const data = await Branch.find(filter).sort({ isHeadOffice: -1, name: 1 }).lean();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lightweight list for the branch switcher. Available to every authenticated
// role (a teacher or student also needs to resolve their own branch label), so
// it returns names only — never contact details.
const listMyBranches = async (req, res) => {
  try {
    const data = await Branch.find({ schoolId: req.tenantId, isDeleted: false, isActive: true })
      .select("_id name code shortName isHeadOffice")
      .sort({ isHeadOffice: -1, name: 1 })
      .lean();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
      isDeleted: false,
    }).lean();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    res.json({ success: true, data: branch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const body = pick(req.body || {}, PICK_FIELDS);

    const name = String(body.name || "").trim();
    if (!name) throw httpError(400, "Branch name is required");

    const code = normalizeCode(body.code || name);
    if (!code) throw httpError(400, "Branch code is required (letters, numbers and dashes)");

    const existingCount = await Branch.countDocuments({ schoolId: req.tenantId, isDeleted: false });
    const limit = await resolveBranchLimit(req.tenantId);
    if (limit !== null && existingCount >= limit) {
      throw branchLimitError(limit, existingCount);
    }

    await assertUniqueCode(req.tenantId, code);

    // The first branch of a school is its head office by definition — there is
    // no campus to fall back to otherwise.
    const isFirst = existingCount === 0;

    const branch = await Branch.create({
      schoolId: req.tenantId,
      name,
      code,
      shortName: body.shortName ? String(body.shortName).trim() : undefined,
      contactName: body.contactName ? String(body.contactName).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      address: body.address ? String(body.address).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      state: body.state ? String(body.state).trim() : undefined,
      pincode: body.pincode ? String(body.pincode).trim() : undefined,
      country: body.country ? String(body.country).trim() : "India",
      isHeadOffice: isFirst,
      isActive: body.isActive === undefined ? true : !!body.isActive,
      settings: body.settings && typeof body.settings === "object" ? body.settings : {},
    });

    await writeAudit({
      req,
      user: req.user,
      action: "branch.created",
      targetType: "branch",
      targetId: branch._id,
      message: `Created branch ${branch.name} (${branch.code})`,
    });

    res.status(201).json({ success: true, data: branch });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.data ? { data: err.data } : {}),
    });
  }
};

const updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
      isDeleted: false,
    });
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    const body = pick(req.body || {}, PICK_FIELDS);

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) throw httpError(400, "Branch name cannot be empty");
      branch.name = name;
    }

    if (body.code !== undefined) {
      const code = normalizeCode(body.code);
      if (!code) throw httpError(400, "Branch code is required (letters, numbers and dashes)");
      if (code !== branch.code) await assertUniqueCode(req.tenantId, code, branch._id);
      branch.code = code;
    }

    for (const field of ["shortName", "contactName", "phone", "address", "city", "state", "pincode", "country"]) {
      if (body[field] !== undefined) branch[field] = body[field] ? String(body[field]).trim() : "";
    }
    if (body.email !== undefined) branch.email = body.email ? String(body.email).trim().toLowerCase() : "";
    if (body.isActive !== undefined) {
      const nextActive = !!body.isActive;
      // A school must always keep at least one usable branch, otherwise every
      // branch-scoped screen would resolve to nothing.
      if (!nextActive) {
        const remaining = await Branch.countDocuments({
          schoolId: req.tenantId,
          isDeleted: false,
          isActive: true,
          _id: { $ne: branch._id },
        });
        if (remaining === 0) {
          throw httpError(409, "At least one branch must stay active");
        }
      }
      branch.isActive = nextActive;
    }
    if (body.settings !== undefined && body.settings && typeof body.settings === "object") {
      branch.settings = body.settings;
    }

    await branch.save();
    await writeAudit({
      req,
      user: req.user,
      action: "branch.updated",
      targetType: "branch",
      targetId: branch._id,
      message: `Updated branch ${branch.name}`,
    });

    res.json({ success: true, data: branch });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

// Promotes a branch to head office and demotes the previous one, so exactly one
// head office exists per school at any time.
const setHeadOffice = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
      isDeleted: false,
    });
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    if (!branch.isActive) throw httpError(409, "An inactive branch cannot be the head office");

    await Branch.updateMany(
      { schoolId: req.tenantId, _id: { $ne: branch._id }, isHeadOffice: true },
      { $set: { isHeadOffice: false } },
    );
    branch.isHeadOffice = true;
    await branch.save();

    await writeAudit({
      req,
      user: req.user,
      action: "branch.head-office-changed",
      targetType: "branch",
      targetId: branch._id,
      message: `${branch.name} is now the head office`,
    });

    res.json({ success: true, data: branch });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

// Soft delete. Branch documents are referenced by branchId from every other
// service's records, so they are never hard-deleted — historical data keeps
// resolving to a (deleted) branch label rather than an empty string.
const deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
      isDeleted: false,
    });
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    const remaining = await Branch.countDocuments({
      schoolId: req.tenantId,
      isDeleted: false,
      _id: { $ne: branch._id },
    });
    if (remaining === 0) {
      throw httpError(409, "A school must keep at least one branch");
    }
    if (branch.isHeadOffice) {
      throw httpError(409, "Set another branch as the head office before deleting this one");
    }

    branch.isDeleted = true;
    branch.isActive = false;
    branch.deletedAt = new Date();
    branch.deletedBy = String(req.user?.id || "");
    await branch.save();

    await writeAudit({
      req,
      user: req.user,
      action: "branch.deleted",
      targetType: "branch",
      targetId: branch._id,
      message: `Deleted branch ${branch.name}`,
    });

    res.json({ success: true, message: "Branch deleted" });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

// Branch cap for the current plan, surfaced in the Branches UI so an admin sees
// how much room is left before hitting the limit.
const getBranchQuota = async (req, res) => {
  try {
    const [used, limit] = await Promise.all([
      Branch.countDocuments({ schoolId: req.tenantId, isDeleted: false }),
      resolveBranchLimit(req.tenantId),
    ]);
    res.json({ success: true, data: { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listBranches,
  listMyBranches,
  getBranch,
  getBranchQuota,
  createBranch,
  updateBranch,
  setHeadOffice,
  deleteBranch,
  normalizeCode,
};
