export default function ThemeSelector({ themes, current, onSelect }) {
  return (
    <div className="theme-selector" role="listbox" aria-label="Theme selection">
      {themes.map((t) => (
        <button
          key={t.id}
          className={`theme-selector__item ${
            current === t.id ? 'theme-selector__item--active' : ''
          }`}
          role="option"
          aria-selected={current === t.id}
          onClick={() => onSelect(t.id)}
        >
          <span className="theme-selector__dot" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
