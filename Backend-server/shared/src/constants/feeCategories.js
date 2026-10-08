// Fee concession categories (the applicant's social category).
//
// Captured on the admission enquiry and carried into onboarding as
// `Student.feeCategory`. Category-wide concessions are expressed against these
// values so one rule ("SC -> 5% Tuition") nets every matching student without
// granting concessions one by one.
//
// SC and ST are separate on purpose: schools routinely set different rates for
// them (e.g. SC 5%, ST 10%).
const FEE_CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

// Applied to records created before the field existed, and to applicants who
// did not declare one. No concession attaches to it, so it is deliberately
// distinct from any category a rule can target.
const DEFAULT_FEE_CATEGORY = "General";

const isFeeCategory = (value) => FEE_CATEGORIES.includes(String(value || "").trim());

module.exports = { FEE_CATEGORIES, DEFAULT_FEE_CATEGORY, isFeeCategory };
