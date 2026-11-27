// Components both photo tool tabs use: credit and license fields, the save bar.

import { useState } from 'react';
import { OWN_LICENSE } from '../../src/lib/schema.ts';
import { uniq, type usePairOptions } from './shared.ts';

/** The credit (none for license "own") and license fields, with a one-line hint. */
export function CreditLicenseFields(props: {
  credit: string;
  license: string;
  options: ReturnType<typeof usePairOptions>;
  onChange: (change: { credit?: string; license?: string }) => void;
}) {
  const o = props.options;
  return (
    <>
      {props.license === OWN_LICENSE ? (
        <div className="field">
          <span>credit</span>
          <span className="muted">none (your own photo)</span>
        </div>
      ) : (
        <ValueSelect
          label="credit"
          value={props.credit}
          options={o.creditOptions}
          onChange={(v) => props.onChange({ credit: v })}
          onAdd={o.onAddCredit}
        />
      )}
      <ValueSelect
        label="license"
        value={props.license}
        options={o.licenseOptions}
        onChange={(v) => props.onChange({ license: v })}
        onAdd={o.onAddLicense}
      />
      <p className="muted small">
        Picking a credit also picks the license most often used with it. License “{OWN_LICENSE}”
        (your own photo) has no credit. New photos start with the last credit and license you chose.
      </p>
    </>
  );
}

const ADD = '\u0000add';

/** A dropdown of known values, with "Add…" to type a new one. */
function ValueSelect(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAdd: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const options = uniq([...props.options, ...(props.value ? [props.value] : [])]);

  const commit = () => {
    const v = text.trim();
    if (!v) return;
    props.onAdd(v);
    props.onChange(v);
    setAdding(false);
    setText('');
  };

  return (
    <label className="field">
      <span>{props.label}</span>
      {adding ? (
        <span>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder={`New ${props.label}`}
          />
          <button onClick={commit} disabled={!text.trim()}>
            OK
          </button>
          <button onClick={() => setAdding(false)}>Cancel</button>
        </span>
      ) : (
        <select
          value={props.value}
          onChange={(e) =>
            e.target.value === ADD ? setAdding(true) : props.onChange(e.target.value)
          }
        >
          {!props.value && (
            <option value="" disabled>
              Choose…
            </option>
          )}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={ADD}>Add…</option>
        </select>
      )}
    </label>
  );
}

/** Save / Revert buttons, the problems that block saving, and the last save's result. */
export function SaveBar(props: {
  dirty: boolean;
  saving: boolean;
  problems: string[];
  result: { ok: boolean; text: string } | null;
  onSave: () => void;
  onRevert: () => void;
}) {
  return (
    <div className="savebar">
      <button
        className="primary"
        disabled={!props.dirty || props.saving || props.problems.length > 0}
        onClick={props.onSave}
      >
        {props.saving ? 'Saving…' : 'Save to YAML'}
      </button>
      <button disabled={!props.dirty || props.saving} onClick={props.onRevert}>
        Revert
      </button>
      {props.dirty && props.problems.length > 0 && (
        <pre className="error small">{props.problems.join('\n')}</pre>
      )}
      {props.result && (
        <pre className={`small ${props.result.ok ? 'ok' : 'error'}`}>{props.result.text}</pre>
      )}
    </div>
  );
}
