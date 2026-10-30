/** A file plus the folder path it came from (if any). */
export interface CollectedFile {
  file: File;
  /** e.g. "notes/week1/summary.md", or just the file name for single files */
  path: string;
}

/** Files chosen with the file input or the "choose folder" input. */
export function fromFileList(list: FileList | null): CollectedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    // webkitRelativePath is filled in when a folder was selected.
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** Walk a dropped folder (and its sub-folders) and collect every file. */
async function walk(entry: FileSystemEntry, out: CollectedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await entryToFile(entry as FileSystemFileEntry);
    out.push({ file, path: entry.fullPath.replace(/^\/+/, "") || file.name });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns results in batches; keep reading until it returns an empty batch.
    for (;;) {
      const batch = await readEntries(reader);
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, out);
    }
  }
}

/** Files and folders dropped onto the drop zone. */
export async function fromDataTransfer(dataTransfer: DataTransfer): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.() ?? null);

  // Browsers clear the DataTransfer after the first await, so grab the plain files first.
  const plainFiles = Array.from(dataTransfer.files ?? []);

  if (entries.length > 0 && entries.every((e) => e !== null)) {
    for (const entry of entries) {
      if (entry) await walk(entry, out);
    }
    return out;
  }
  return plainFiles.map((file) => ({ file, path: file.name }));
}

/** SHA-256 of a file as hex. Used to detect duplicates. (Needs https or localhost.) */
export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
