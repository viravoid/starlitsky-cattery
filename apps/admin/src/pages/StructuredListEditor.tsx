type JsonRecord = Record<string, unknown>;

interface Field {
  key: string;
  label: string;
  multiline?: boolean;
}

export function StructuredListEditor({
  addLabel,
  fields,
  items,
  newItem,
  onChange,
}: {
  addLabel: string;
  fields: Field[];
  items: JsonRecord[];
  newItem: () => JsonRecord;
  onChange: (items: JsonRecord[]) => void;
}) {
  const updateItem = (index: number, patch: JsonRecord) =>
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const move = (index: number, target: number) => {
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return <div className="form-stack">
    {items.map((item, index) =>
      <div className="structured-section-card" key={typeof item.id === "string" ? item.id : index}>
        <div className="section-heading">
          <span className="muted">#{index + 1}</span>
          <div className="table-actions">
            <button className="secondary-button small-button" type="button" disabled={index === 0} onClick={() => move(index, index - 1)}>上移</button>
            <button className="secondary-button small-button" type="button" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>下移</button>
            <button className="danger-button small-button" type="button" onClick={() => {
              if (window.confirm("确定删除这一项吗？")) onChange(items.filter((_, itemIndex) => itemIndex !== index));
            }}>删除</button>
          </div>
        </div>
        {fields.map((field) =>
          <label key={field.key}>{field.label}
            {field.multiline
              ? <textarea rows={3} value={string(item[field.key])} onChange={(event) => updateItem(index, { [field.key]: event.target.value })} />
              : <input value={string(item[field.key])} onChange={(event) => updateItem(index, { [field.key]: event.target.value })} />}
          </label>,
        )}
      </div>,
    )}
    <button className="secondary-button" type="button" onClick={() => onChange([...items, newItem()])}>{addLabel}</button>
  </div>;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
