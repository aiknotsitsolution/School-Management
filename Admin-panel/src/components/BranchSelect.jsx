import { Select } from "./UI";

/**
 * Campus picker shared by the forms that create a person or an account.
 *
 * Pure presentational: the page owns the data via `useBranches()` and passes the
 * list in, so a page with two pickers (Users does) fetches once.
 *
 * `allOption` adds a school-wide entry. That is the right default for a parent
 * account, since children can sit in more than one campus, and for a principal
 * who needs to see the whole school — an account scoped to one campus cannot
 * read the others.
 *
 * Renders nothing for a single-campus school: there is exactly one possible
 * answer, and the campus is already the active one, so a picker would only add
 * noise.
 */
export default function BranchSelect({
  branches = [],
  loading = false,
  value,
  onChange,
  allOption = false,
  allLabel = "All campuses",
  placeholder = "Select campus",
  disabled = false,
  className,
}) {
  if (!loading && !branches.length) return null;

  return (
    <Select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={className}
    >
      <option value="">{allOption ? allLabel : placeholder}</option>
      {branches.map((b) => (
        <option key={b._id} value={b._id}>
          {b.name}
          {b.isHeadOffice ? " (default)" : ""}
        </option>
      ))}
    </Select>
  );
}
