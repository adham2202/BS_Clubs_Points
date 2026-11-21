import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { ExternalLink, Upload } from 'lucide-react';
import { CLUBS } from '../data/clubs';
import {
  detectSheetColumns,
  extractSheetRows,
  fetchDriveCsv,
  parseCsvTable,
  resolveDriveCsvUrl,
  type ClubDriveSource,
  type ClubDriveSources,
  type SheetColumnMapping,
  type SyncedMemberRow,
} from '../state/driveSync';
import type { ClubId, Committee } from '../types/tracker';
import { Modal } from './Modal';

interface DriveSyncModalProps {
  lockedClub: ClubId | null;
  initialClubId: ClubId;
  clubNames: Record<ClubId, string>;
  sources: ClubDriveSources;
  existingCommittees: Committee[];
  onSaveSource: (clubId: ClubId, source: ClubDriveSource) => void;
  onApplySync: (payload: {
    clubId: ClubId;
    mode: 'merge' | 'replace';
    rows: SyncedMemberRow[];
    sourceUrl: string;
  }) => void;
  onClose: () => void;
}

export function DriveSyncModal({
  lockedClub,
  initialClubId,
  clubNames,
  sources,
  existingCommittees,
  onSaveSource,
  onApplySync,
  onClose,
}: DriveSyncModalProps) {
  const clubSelectId = useId();
  const urlInputId = useId();
  const csvFileId = useId();
  const defaultCommitteeId = useId();
  const colNameId = useId();
  const colCommitteeId = useId();
  const colPhoneId = useId();
  const colEmailId = useId();
  const colPointsId = useId();
  const colRoleId = useId();

  const [clubId, setClubId] = useState<ClubId>(lockedClub ?? initialClubId);
  const [urlDraft, setUrlDraft] = useState(sources[lockedClub ?? initialClubId].url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<SheetColumnMapping>({
    name: null,
    committee: null,
    phone: null,
    email: null,
    role: null,
    points: null,
  });
  const [fallbackCommittee, setFallbackCommittee] = useState(() => {
    const first = existingCommittees.find(
      (c) => c.clubId === (lockedClub ?? initialClubId),
    );
    return first?.name ?? 'General';
  });
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  const handleClubChange = (nextClub: ClubId) => {
    setClubId(nextClub);
    setUrlDraft(sources[nextClub].url);
    setTable([]);
    setError('');
    setMode('merge');
    const first = existingCommittees.find((c) => c.clubId === nextClub);
    setFallbackCommittee(first?.name ?? 'General');
  };

  const applyParsedCsv = (csvText: string) => {
    const parsed = parseCsvTable(csvText);
    if (parsed.length <= 1) {
      throw new Error('Sheet has no member rows.');
    }
    setTable(parsed);
    setMapping(detectSheetColumns(parsed[0]));
    setError('');
  };

  const handleLoadUrl = async () => {
    const trimmed = urlDraft.trim();
    const resolution = resolveDriveCsvUrl(trimmed);
    if (!resolution.ok) {
      setError(resolution.error);
      return;
    }

    onSaveSource(clubId, { ...sources[clubId], url: trimmed });
    setLoading(true);
    setError('');
    try {
      const csvText = await fetchDriveCsv(trimmed);
      applyParsedCsv(csvText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      applyParsedCsv(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read CSV file.');
    }
  };

  const headers = table.length > 0 ? table[0] : [];
  const extractedRows = useMemo(
    () => extractSheetRows(table, mapping, fallbackCommittee),
    [table, mapping, fallbackCommittee],
  );
  const uniqueCommittees = useMemo(
    () => new Set(extractedRows.map((r) => r.committeeName.toLowerCase())).size,
    [extractedRows],
  );

  const validExternalHref = useMemo(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return null;
    const withScheme = /^(docs\.google\.com|drive\.google\.com)\//i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
    try {
      const u = new URL(withScheme);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
    } catch {
      return null;
    }
  }, [urlDraft]);

  const mapSelect = (
    id: string,
    label: string,
    value: number | null,
    required: boolean,
    onChange: (next: number | null) => void,
  ) => (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <select
        id={id}
        className="select-input"
        value={value === null ? '' : String(value)}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
      >
        {!required && <option value="">—</option>}
        {headers.map((h, idx) => (
          <option key={`${id}-${idx}`} value={idx}>
            {h || `Column ${idx + 1}`}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal title="Google Drive Sync" onClose={onClose} maxWidth={600}>
      <div className="modal-body">
        {!lockedClub && (
          <div className="form-field">
            <label htmlFor={clubSelectId} className="form-label">
              Club
            </label>
            <select
              id={clubSelectId}
              className="select-input"
              value={clubId}
              onChange={(e) => handleClubChange(e.target.value as ClubId)}
            >
              {CLUBS.map((club) => (
                <option key={club.id} value={club.id}>
                  {clubNames[club.id]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-field">
          <label htmlFor={urlInputId} className="form-label">
            Drive / Sheet Link
          </label>
          <div className="drive-url-row">
            <input
              id={urlInputId}
              type="url"
              className="text-input"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                setError('');
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!urlDraft.trim() || loading}
              onClick={handleLoadUrl}
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
            {validExternalHref && (
              <a
                href={validExternalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                aria-label="Open Drive link in new tab"
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>Open</span>
              </a>
            )}
          </div>
        </div>

        <div className="drive-toolbar-row">
          <input
            id={csvFileId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Upload CSV file"
            onChange={handleUploadCsv}
          />
          <label htmlFor={csvFileId} className="btn btn-sm settings-upload-btn">
            <Upload size={13} aria-hidden="true" />
            <span>Upload CSV</span>
          </label>

          {extractedRows.length > 0 && (
            <span className="roster-summary mono-num">
              {extractedRows.length}{' '}
              {extractedRows.length === 1 ? 'member' : 'members'} &middot;{' '}
              {uniqueCommittees}{' '}
              {uniqueCommittees === 1 ? 'committee' : 'committees'}
            </span>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {table.length > 0 && (
          <>
            <div className="drive-mapping-grid">
              {mapSelect(colNameId, 'Name', mapping.name, true, (next) =>
                setMapping((prev) => ({ ...prev, name: next })),
              )}
              {mapSelect(colCommitteeId, 'Committee', mapping.committee, false, (next) =>
                setMapping((prev) => ({ ...prev, committee: next })),
              )}
              {mapSelect(colPhoneId, 'Phone', mapping.phone, false, (next) =>
                setMapping((prev) => ({ ...prev, phone: next })),
              )}
              {mapSelect(colEmailId, 'Email', mapping.email, false, (next) =>
                setMapping((prev) => ({ ...prev, email: next })),
              )}
              {mapSelect(colPointsId, 'Points', mapping.points, false, (next) =>
                setMapping((prev) => ({ ...prev, points: next })),
              )}
              {mapSelect(colRoleId, 'Role', mapping.role, false, (next) =>
                setMapping((prev) => ({ ...prev, role: next })),
              )}
            </div>

            {mapping.committee === null && (
              <div className="form-field">
                <label htmlFor={defaultCommitteeId} className="form-label">
                  Default committee
                </label>
                <input
                  id={defaultCommitteeId}
                  type="text"
                  className="text-input"
                  value={fallbackCommittee}
                  onChange={(e) => setFallbackCommittee(e.target.value)}
                />
              </div>
            )}

            <div className="segmented-tabs" role="tablist" aria-label="Import mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'merge'}
                className={`segmented-tab${mode === 'merge' ? ' active' : ''}`}
                onClick={() => setMode('merge')}
              >
                Merge &amp; update
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'replace'}
                className={`segmented-tab${mode === 'replace' ? ' active' : ''}`}
                onClick={() => setMode('replace')}
              >
                Replace club
              </button>
            </div>

            {extractedRows.length > 0 && (
              <div className="ledger-table-card">
                <div className="table-scroll">
                  <table className="ledger-table compact drive-preview-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Committee</th>
                        <th scope="col">Phone</th>
                        <th scope="col">Email</th>
                        <th scope="col" className="num-col">
                          Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRows.slice(0, 4).map((row, idx) => (
                        <tr key={`${row.name}-${idx}`}>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td>{row.committeeName}</td>
                          <td className="mono-num">{row.phone || '—'}</td>
                          <td>{row.email || '—'}</td>
                          <td className="num-col mono-num">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={extractedRows.length === 0}
          onClick={() => {
            onApplySync({
              clubId,
              mode,
              rows: extractedRows,
              sourceUrl: urlDraft.trim(),
            });
            onClose();
          }}
        >
          Import {extractedRows.length} Members
        </button>
      </div>
    </Modal>
  );
}
