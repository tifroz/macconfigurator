// 12 Lines by Claude Opus
// JSON editor component with syntax highlighting and validation
import React, { useState, useEffect } from 'react';

interface JsonEditorProps {
  value: any;
  onChange: (value: any, isValid: boolean) => void;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
}

export default function JsonEditor({ 
  value, 
  onChange, 
  className = '', 
  placeholder = '{}',
  onBlur 
}: JsonEditorProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Format initial value
    try {
      setText(JSON.stringify(value, null, 2));
    } catch {
      setText('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    try {
      const parsed = JSON.parse(newText);
      setError('');
      onChange(parsed, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      onChange(null, false);
    }
  };

  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`
          json-editor w-full p-3 border rounded-md bg-gray-900 text-gray-100
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}
        `}
        rows={10}
        spellCheck={false}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}