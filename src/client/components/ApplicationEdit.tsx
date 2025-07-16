// 30 Lines by Claude Opus
// Application edit view for creating/editing applications
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import JsonEditor from './JsonEditor';
import { useAutosave } from '../hooks/useAutosave';

interface NamedConfig {
  data: any;
  versions: string[];
}

interface Application {
  applicationId: string;
  archived: boolean;
  namedConfigs: Record<string, NamedConfig>;
  defaultConfig: { data: any };
  schema: any;
  lastUpdated: string;
}

const DEFAULT_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
};

export default function ApplicationEdit() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const isNew = !applicationId;

  const [app, setApp] = useState<Application>({
    applicationId: '',
    archived: false,
    namedConfigs: {},
    defaultConfig: { data: {} },
    schema: DEFAULT_SCHEMA,
    lastUpdated: new Date().toISOString()
  });

  const [loading, setLoading] = useState(!isNew);
  const [validJson, setValidJson] = useState({ schema: true, config: true });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      fetchApplication();
    }
  }, [applicationId]);

  const fetchApplication = async () => {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`);
      if (!response.ok) throw new Error('Failed to fetch application');
      const data = await response.json();
      setApp(data);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveApplication = async () => {
    if (!validJson.schema || !validJson.config) {
      throw new Error('Invalid JSON in schema or config');
    }

    const method = isNew ? 'POST' : 'PUT';
    const url = isNew 
      ? '/api/admin/applications' 
      : `/api/admin/applications/${applicationId}`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app)
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.errors) {
        throw new Error(error.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n'));
      }
      throw new Error(error.error || 'Save failed');
    }

    if (isNew) {
      const created = await response.json();
      navigate(`/applications/${created.applicationId}`, { replace: true });
    }
  };

  const { triggerSave, saveOnBlur, status, error } = useAutosave(saveApplication);

  const handleDelete = async (configName: string) => {
    if (!confirm(`Delete configuration "${configName}"?`)) return;

    try {
      const response = await fetch(
        `/api/admin/applications/${applicationId}/configs/${configName}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');
      await fetchApplication();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreateConfig = async () => {
    const name = prompt('Enter configuration name:');
    if (!name) return;

    try {
      const response = await fetch(
        `/api/admin/applications/${applicationId}/configs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            data: app.defaultConfig.data,
            versions: []
          })
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }
      await fetchApplication();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed');
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-6 text-sm">
        <Link to="/" className="text-blue-600 hover:underline">home</Link>
        {!isNew && <span className="text-gray-500"> / {applicationId}</span>}
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'Create Application' : 'Edit Application'}
      </h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application ID
          </label>
          <input
            type="text"
            value={app.applicationId}
            onChange={(e) => {
              if (isNew) {
                setApp({ ...app, applicationId: e.target.value });
                triggerSave();
              }
            }}
            onBlur={saveOnBlur}
            disabled={!isNew}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {!isNew && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Named Configurations
              </label>
              <button
                onClick={handleCreateConfig}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create New
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(app.namedConfigs).map(([name, config]) => (
                <div key={name} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                  <Link
                    to={`/applications/${applicationId}/configs/${name}`}
                    className="flex-1 text-blue-600 hover:underline"
                  >
                    {name}
                  </Link>
                  <span className="text-sm text-gray-500">
                    {config.versions.length} version{config.versions.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => handleDelete(name)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schema
          </label>
          <JsonEditor
            value={app.schema}
            onChange={(value, isValid) => {
              setValidJson({ ...validJson, schema: isValid });
              if (isValid) {
                setApp({ ...app, schema: value });
                triggerSave();
              }
            }}
            onBlur={saveOnBlur}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Configuration
          </label>
          <JsonEditor
            value={app.defaultConfig.data}
            onChange={(value, isValid) => {
              setValidJson({ ...validJson, config: isValid });
              if (isValid) {
                setApp({ ...app, defaultConfig: { data: value } });
                triggerSave();
              }
            }}
            onBlur={saveOnBlur}
          />
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          
          {status === 'saving' && <span className="text-gray-500">Saving...</span>}
          {status === 'saved' && <span className="text-green-600">Saved</span>}
          {status === 'error' && (
            <div className="text-red-600">
              {(error || saveError || '').split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}