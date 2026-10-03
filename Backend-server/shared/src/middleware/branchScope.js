const mongoose = require("mongoose");

// Matches a strictly 24-char hex ObjectId, same reasoning as tenant.js: a junk
// header must never reach a query (it would surface as a CastError 500).
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const ALL_BRANCHES = "all";

// Roles that may be *given* a school-wide view. Note this is not the same as
// "may send `all`": an admin who is assigned to a campus is pinned to it (see
// canViewAllBranches), because trusting the header alone let a head-office
// admin read another campus's rows.
const BRANCH_ADMIN_ROLES = new Set(["super_admin", "school_admin"]);

const isBranchAdmin = (user) => BRANCH_ADMIN_ROLES.has(String(user?.role || ""));

/**
 * Who may ask for `X-Branch-Id: all`.
 *
 * Only a super_admin, or a school_admin who is NOT assigned to a campus (the
 * principal of a single-campus school, who has no branchId in their token).
 * A campus-assigned school_admin is deliberately excluded: they are one of the
 * principals of a multi-campus school, so a school-wide view would defeat the
 * isolation they were given.
 */
function canViewAllBranches(user) {
  if (String(user?.role || "") === "super_admin") return true;
  return isBranchAdmin(user) && !user?.branchId;
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Resolves the branch a request is scoped to and exposes it as `req.branchId`.
 * Must run AFTER resolveTenant.
 *
 * Precedence:
 *   1. `X-Branch-Id: all`      -> null (school-wide view, only if canViewAllBranches)
 *   2. `X-Branch-Id: <id>`     -> that branch, but never a campus other than the
 *                                 caller's own
 *   3. `req.user.branchId`     -> the branch the account is assigned to
 *   4. otherwise               -> null (school-wide)
 *
 * A null `req.branchId` always means "do not filter by branch". That is what
 * keeps single-campus schools and unassigned school admins working unchanged:
 * they never send the header and never carry a branchId in their token.
 *
 * A campus-assigned account is PINNED to its own campus: `all` is refused and a
 * header naming a different campus is refused, even though the id is a genuine
 * branch of the same school. Validating only against the school was not enough
 * — a head-office admin could name the other campus and read its rows. Services
 * other than auth-service cannot even check school membership (the Branch
 * collection is not registered there), so the pin has to be decided from the
 * token alone.
 *
 * Ownership of a branch id is only verifiable where the Branch collection lives
 * (auth-service). In the other services a forged header from an account with no
 * branch of its own can only ever match zero documents — branch ids are unique
 * per school, so a foreign id can never return another school's rows — which is
 * why this degrades to an empty list instead of a 403 there.
 */
const resolveBranchScope = async (req, res, next) => {
  try {
    const rawHeader = req.header("X-Branch-Id");
    const tokenBranch = req.user?.branchId ? String(req.user.branchId) : null;

    if (!rawHeader) {
      req.branchId = tokenBranch;
      return next();
    }

    const candidate = String(rawHeader).trim();
    if (candidate.toLowerCase() === ALL_BRANCHES) {
      if (!canViewAllBranches(req.user)) {
        return res.status(403).json({ success: false, message: "Only an admin can view all branches at once" });
      }
      req.branchId = null;
      req.allBranches = true;
      return next();
    }

    if (!OBJECT_ID_REGEX.test(candidate)) {
      return res.status(400).json({ success: false, message: "X-Branch-Id must be a valid ObjectId" });
    }

    // Pinned to one campus: the header may confirm that campus, nothing else.
    if (tokenBranch && candidate !== tokenBranch) {
      return res.status(403).json({ success: false, message: "You are not allowed to view another branch" });
    }

    const BranchModel = mongoose.models.Branch;
    if (BranchModel) {
      const branch = await BranchModel.findOne({
        _id: candidate,
        schoolId: req.tenantId,
        isDeleted: false,
      })
        .select({ _id: 1 })
        .lean();
      if (!branch) {
        return res.status(400).json({ success: false, message: "Branch does not belong to this school" });
      }
    }

    req.branchId = candidate;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Branch *filtering* is rolled out behind BRANCH_SCOPE so the migration can be
 * done in a safe order:
 *
 *   1. deploy this code            -> BRANCH_SCOPE unset, nothing is filtered
 *   2. run scripts/backfill-branches.js --apply
 *   3. set BRANCH_SCOPE=on          -> real per-branch isolation kicks in
 *
 * Until step 3 every query still sees all of the school's rows, so a failed or
 * half-finished backfill can never blank out a school's UI. Resolving
 * req.branchId and stamping branchId on writes are deliberately NOT gated: they
 * are additive and make step 2 idempotent.
 */
function branchScopeEnabled() {
  return String(process.env.BRANCH_SCOPE || "").toLowerCase() === "on";
}

/**
 * Adds the active-branch constraint to a list filter. Returns the filter
 * untouched when no branch is active or BRANCH_SCOPE is off, so school-wide
 * callers and the pre-migration state need no changes.
 * Pass `opts.allBranches` to opt a query out (dashboards that must aggregate the
 * whole school even while a branch is selected).
 */
function withBranchScope(req, filter = {}, opts = {}) {
  if (opts.allBranches) return filter;
  if (!branchScopeEnabled()) return filter;
  if (!req?.branchId) return filter;
  return { ...filter, branchId: req.branchId };
}

/**
 * Branch value for a document being created/updated: the request's active
 * branch by default. An explicit `requested` branch is only honoured for
 * admins, so a teacher can never move a record into another campus by posting a
 * foreign branchId.
 */
function branchIdForWrite(req, requested) {
  if (requested && isBranchAdmin(req?.user)) return String(requested);
  return req?.branchId || null;
}

/**
 * Same as branchIdForWrite but asynchronous, so it can also prove the requested
 * branch really belongs to the caller's school. Throws a 4xx httpError, which
 * every controller in this repo already forwards to the error handler.
 */
async function assertBranchAssignable(req, requested) {
  if (!requested) return branchIdForWrite(req);
  if (!isBranchAdmin(req?.user)) {
    throw httpError(403, "Only an admin can assign a record to another branch");
  }
  const candidate = String(requested).trim();
  if (!OBJECT_ID_REGEX.test(candidate)) {
    throw httpError(400, "branchId must be a valid ObjectId");
  }
  // Verified only where the Branch collection is registered; elsewhere a bad id
  // simply matches nothing, which is why this falls through instead of failing.
  const BranchModel = mongoose.models.Branch;
  if (BranchModel) {
    const branch = await BranchModel.findOne({
      _id: candidate,
      schoolId: req.tenantId,
      isDeleted: false,
    })
      .select({ _id: 1 })
      .lean();
    if (!branch) throw httpError(400, "Branch does not belong to this school");
  }
  return candidate;
}

// True when a document's branch is visible in the current scope. Documents with
// no branchId are pre-branch-scoping rows: they stay visible to everyone so a
// backfill gap can never hide a student from their own school. Honours the same
// BRANCH_SCOPE rollout flag as withBranchScope.
function branchVisible(req, docBranchId) {
  if (!branchScopeEnabled()) return true;
  if (!req?.branchId) return true;
  if (!docBranchId) return true;
  return String(docBranchId) === String(req.branchId);
}

/**
 * A model is branch-scoped iff its schema has a `branchId` path. The migration
 * added that field to exactly the branch-owned collections, so this is the
 * authoritative test and lets callers wrap a filter without hand-listing which
 * masters are school-wide (leave types, notice categories, time slots, ...).
 */
function isBranchScopedModel(model) {
  try {
    return Boolean(model?.schema?.path("branchId"));
  } catch {
    return false;
  }
}

/** A mongoose Query is thenable and carries a private filter. */
function isQueryLike(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.then === "function" && value._conditions) return true;
  return value.constructor?.name === "Query";
}

/**
 * Model-aware withBranchScope. Prefer this in controllers: a school-wide
 * collection is returned untouched instead of being filtered down to zero rows.
 *
 * Guarded on purpose. `scopeQuery(Model.findOne(f), Model, req)` used to return
 * the express `req` unchanged (a Query has no `.schema`, so the call fell
 * through to the unfiltered branch) and that broke ~170 endpoints with a
 * misleading 409/500 instead of a clear error. A query as the first argument is
 * always a mistake, so refuse it loudly.
 */
function scopeQuery(model, req, filter = {}, opts = {}) {
  if (isQueryLike(model)) {
    throw new TypeError(
      "scopeQuery(model, req, filter) was called with a query as the first argument. " +
        "Wrap the filter instead: scopeQuery(Model.findOne(scopeQuery(Model, req, filter)), ...) " +
        "or Model.findOne(scopeQuery(Model, req, filter)).",
    );
  }
  if (isQueryLike(req)) {
    throw new TypeError("scopeQuery(model, req, filter) was called with a query as the second argument.");
  }
  if (!model) {
    throw new TypeError("scopeQuery(model, req, filter) requires a model as the first argument.");
  }
  if (filter && typeof filter === "object" && (typeof filter.then === "function" || filter.status || filter.headers)) {
    throw new TypeError(
      "scopeQuery(model, req, filter) looks like it received the request as the filter. " +
        "Correct usage: scopeQuery(Model, req, filter).",
    );
  }
  if (!isBranchScopedModel(model)) return filter;
  return withBranchScope(req, filter, opts);
}

module.exports = {
  resolveBranchScope,
  withBranchScope,
  scopeQuery,
  isBranchScopedModel,
  branchScopeEnabled,
  branchIdForWrite,
  assertBranchAssignable,
  branchVisible,
  isBranchAdmin,
  canViewAllBranches,
  ALL_BRANCHES,
};
