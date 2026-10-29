import { useState } from "react"

export function TagInput({ label, values, onChange, required = false }: { label: string; values: string[]; onChange: (values: string[]) => void; required?: boolean }) {
  const [input, setInput] = useState("")
  const inputId = `tags-${label.toLowerCase().replace(/\s+/g, "-")}`
  const add = () => {
    const entries = input.split(",").map(value => value.trim()).filter(Boolean)
    if (entries.length) {
      const next = [...values]
      for (const entry of entries) {
        if (!next.some(value => value.trim().toLowerCase() === entry.toLowerCase())) next.push(entry)
      }
      onChange(next)
    }
    setInput("")
  }
  return <div className="package-tag-field full"><div className="package-tag-heading"><label htmlFor={inputId}>{label}{required && " *"}</label>{values.length > 0 && <button type="button" aria-label={`Remove all ${label.toLowerCase()}`} onClick={() => onChange([])}>Remove all</button>}</div><div className="package-tags">{values.map(value => <span className="package-tag" key={value}>{value}<button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter(item => item !== value))}>×</button></span>)}<input id={inputId} value={input} placeholder={values.length ? "Add another" : `Add ${label.toLowerCase()}`} onChange={event => setInput(event.target.value)} onBlur={add} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add() } }} /></div><small>Type a value and press Enter or comma.</small></div>
}
