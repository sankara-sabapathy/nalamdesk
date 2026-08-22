import * as path from 'path';

export interface RestoreBundleSelection { path: string; name: string }

/** Narrow adapter around Electron's dialog; renderer never receives filesystem APIs. */
export async function selectRestoreBundle(
    showDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
): Promise<RestoreBundleSelection | null> {
    const result = await showDialog();
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = result.filePaths[0];
    const extension = path.extname(selected).toLowerCase();
    if (extension !== '.ndbackup' && extension !== '.db') throw new Error('UNSUPPORTED_BACKUP_FILE');
    return { path: selected, name: path.basename(selected) };
}
