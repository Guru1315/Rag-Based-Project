import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DOCUMENT_STATUSES, FORMAT_LABELS, SUPPORTED_EXTENSIONS } from "@/lib/config";

/**
 * Search / filter / sort bar. It is a plain GET form, so the values live in the URL
 * (shareable, back-button friendly) and it works without any client-side JavaScript.
 */
export function DocumentFilters({
  action,
  values,
  knowledgeBases,
}: {
  action: string;
  values: { q?: string; type?: string; status?: string; sort?: string; kb?: string };
  /** Pass a list to show the "knowledge base" filter. */
  knowledgeBases?: { id: string; name: string }[];
}) {
  return (
    <form method="get" action={action} role="search" aria-label="Filter documents" className="mb-4 flex flex-wrap items-end gap-3">
      <div className="relative min-w-48 flex-1">
        <label htmlFor="f-q" className="sr-only">
          Search documents by name
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="f-q" name="q" defaultValue={values.q ?? ""} placeholder="Search by file name…" className="pl-9" maxLength={100} />
      </div>
      {knowledgeBases ? (
        <div>
          <label htmlFor="f-kb" className="sr-only">
            Knowledge base
          </label>
          <Select id="f-kb" name="kb" defaultValue={values.kb ?? ""} className="w-44">
            <option value="">All knowledge bases</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <label htmlFor="f-type" className="sr-only">
          File type
        </label>
        <Select id="f-type" name="type" defaultValue={values.type ?? ""} className="w-36">
          <option value="">All types</option>
          {SUPPORTED_EXTENSIONS.map((ext) => (
            <option key={ext} value={ext}>
              {FORMAT_LABELS[ext]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="f-status" className="sr-only">
          Status
        </label>
        <Select id="f-status" name="status" defaultValue={values.status ?? ""} className="w-36">
          <option value="">All statuses</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="f-sort" className="sr-only">
          Sort by
        </label>
        <Select id="f-sort" name="sort" defaultValue={values.sort ?? "recent"} className="w-40">
          <option value="recent">Recent activity</option>
          <option value="upload">Upload date</option>
          <option value="name">Name</option>
        </Select>
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
