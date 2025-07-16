// 10 Lines by Claude Opus
// Component for editing semver version lists
import React, { useState } from 'react';
import * as semver from 'semver';

interface SemverListProps {
  versions: string[];
  onChange: (versions: string[]) => void;
  onBlur?: () => void;
  onImmediateChange?: (versions: string[]) => void;
}

export default function SemverList({ versions, onChange, onBlur, onImmediateChange }: SemverListProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!semver.valid(trimmed)) {
      setError(`Invalid semver: ${trimmed}`);
      return;
    }

    if (versions.includes(trimmed)) {
      setError('Version already exists');
      return;
    }

    onChange([...versions, trimmed]);
    setInputValue('');
    setError('');
    return true; // Indicates successful add
  };

  const handleRemove = (version: string) => {
    const newVersions = versions.filter(v => v !== version);
    onChange(newVersions);
    // If onImmediateChange is provided, call it for immediate save
    if (onImmediateChange) {
      onImmediateChange(newVersions);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleBlur = () => {
    // Try to add the current input value if it's valid
    const trimmed = inputValue.trim();
    if (trimmed && semver.valid(trimmed) && !versions.includes(trimmed)) {
      handleAdd();
    }
    // Always call the parent's onBlur handler
    if (onBlur) {
      onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {versions.map(version => (
          <span
            key={version}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
          >
            {version}
            <button
              type="button"
              onClick={() => handleRemove(version)}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
          placeholder="x.y.z"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add
        </button>
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}