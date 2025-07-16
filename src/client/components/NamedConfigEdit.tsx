// 20 Lines by Claude Opus
// Named configuration edit view
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import JsonEditor from './JsonEditor';
import SemverList from './SemverList';
import { useAutosave } from '../hooks/useAutosave';

export default function NamedConfigEdit() {
  const { applicationId, configName } = useParams();
  const navigate = useNavigate();
  const isNew = configName === 'new';

  const [app, setApp] = useState<any>(null);
  const [name, setName] = useState('');
  const [data, setData] = useState({});
  const [versions, setVersions] = useState<string[]>([]);
  // Keep a ref in sync with the latest versions so saves always use the current value
  const versionsRef = useRef<string[]>([]);
  useEffect(() => {
    versionsRef.current = versions;
  }, [versions]);

  const [validJson, setValidJson] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplication();
  }, [applicationId, configName]);

  const fetchApplication = async () => {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`);
      if (!response.ok) throw new Error('Failed to fetch application');
      const appData = await response.json();
      setApp(appData);

      if (!isNew && appData.namedConfigs[configName!]) {
        const config = appData.namedConfigs[configName!];
        setName(configName!);
        setData(config.data);
        setVersions(config.versions);
      } else if (!isNew) {
        throw new Error('Configuration not found');
      } else {
        // For new config, seed with default config
        setData(appData.defaultConfig.data);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Load failed');
      navigate(`/applications/${applicationId}`);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!validJson) {
      throw new Error('Invalid JSON');
    }

    const method = isNew ? 'POST' : 'PUT';
    const url = isNew
      ? `/api/admin/applications/${applicationId}/configs`
      : `/api/admin/applications/${applicationId}/configs/${configName}`;

    const currentVersions = versionsRef.current;
    const body = isNew
      ? { name, data, versions: currentVersions }
      : { data, versions: currentVersions };

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.errors) {
        throw new Error(error.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n'));
      }
      throw new Error(error.error || 'Save failed');
    }

    if (isNew) {
      navigate(`/applications/${applicationId}/configs/${name}`, { replace: true });
    }
  };

  const { triggerSave, saveOnBlur, executeSave, status, error } = useAutosave(saveConfig);

  if (loading) return <div className="text-center py-4">Loading...</div>;
  if (!app) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-6 text-sm">
        <Link to="/" className="text-blue-600 hover:underline">home</Link>
        <span className="text-gray-500"> / </span>
        <Link to={`/applications/${applicationId}`} className="text-blue-600 hover:underline">
          {applicationId}
        </Link>
        {!isNew && <span className="text-gray-500"> / {configName}</span>}
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'Create Named Configuration' : `Edit ${configName}`}
      </h1>

      <div className="space-y-6">
        {isNew && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                triggerSave();
              }}
              onBlur={saveOnBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Semver Versions
          </label>
          <SemverList
            versions={versions}
            onChange={(newVersions) => {
              versionsRef.current = newVersions; // Update ref immediately
              setVersions(newVersions);
              triggerSave();
            }}
            onBlur={saveOnBlur}
            onImmediateChange={(newVersions) => {
              versionsRef.current = newVersions; // Update ref immediately
              setVersions(newVersions);
              executeSave();
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configuration Data
          </label>
          <JsonEditor
            value={data}
            onChange={(value, isValid) => {
              setValidJson(isValid);
              if (isValid) {
                setData(value);
                triggerSave();
              }
            }}
            onBlur={saveOnBlur}
          />
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate(`/applications/${applicationId}`)}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          
          {status === 'saving' && <span className="text-gray-500">Saving...</span>}
          {status === 'saved' && <span className="text-green-600">Saved</span>}
          {status === 'error' && (
            <div className="text-red-600">
              {(error || '').split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}