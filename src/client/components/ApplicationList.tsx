// 25 Lines by Claude Opus
// Application list view showing all apps with inline semver editing
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SemverList from './SemverList';
import { useAutosave } from '../hooks/useAutosave';

interface Application {
  applicationId: string;
  archived: boolean;
  namedConfigs: Record<string, { data: any; versions: string[] }>;
  defaultConfig: { data: any };
  schema: any;
  lastUpdated: string;
}

export default function ApplicationList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/admin/applications');
      if (!response.ok) throw new Error('Failed to fetch applications');
      const data = await response.json();
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleArchive = async (applicationId: string) => {
    if (!confirm(`Archive application ${applicationId}?`)) return;

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/archive`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to archive');
      await fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const handleUnarchive = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/unarchive`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to unarchive');
      await fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unarchive failed');
    }
  };

  const updateNamedConfigVersions = async (
    applicationId: string,
    configName: string,
    versions: string[]
  ) => {
    const app = applications.find(a => a.applicationId === applicationId);
    if (!app) return;

    const response = await fetch(`/api/admin/applications/${applicationId}/configs/${configName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: app.namedConfigs[configName].data,
        versions
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Update failed');
    }

    await fetchApplications();
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;
  if (error) return <div className="text-red-600 text-center py-4">{error}</div>;

  const activeApps = applications.filter(app => !app.archived).sort((a, b) => 
    a.applicationId.localeCompare(b.applicationId)
  );
  const archivedApps = applications.filter(app => app.archived).sort((a, b) => 
    a.applicationId.localeCompare(b.applicationId)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <button
          onClick={() => navigate('/applications/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Application
        </button>
      </div>

      <div className="space-y-4">
        {activeApps.map(app => (
          <ApplicationCard
            key={app.applicationId}
            app={app}
            onArchive={handleArchive}
            onUpdateVersions={updateNamedConfigVersions}
          />
        ))}
      </div>

      {archivedApps.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Archived Applications</h2>
          <div className="space-y-2">
            {archivedApps.map(app => (
              <div key={app.applicationId} className="flex items-center gap-4 p-2 bg-gray-100 rounded">
                <Link
                  to={`/applications/${app.applicationId}`}
                  className="text-blue-600 hover:underline"
                >
                  {app.applicationId}
                </Link>
                <button
                  onClick={() => handleUnarchive(app.applicationId)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Unarchive
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ 
  app, 
  onArchive, 
  onUpdateVersions 
}: { 
  app: Application;
  onArchive: (id: string) => void;
  onUpdateVersions: (appId: string, configName: string, versions: string[]) => Promise<void>;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <Link
          to={`/applications/${app.applicationId}`}
          className="text-xl font-semibold text-blue-600 hover:underline"
        >
          {app.applicationId}
        </Link>
        <button
          onClick={() => onArchive(app.applicationId)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Archive
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(app.namedConfigs).map(([name, config]) => (
          <NamedConfigRow
            key={name}
            applicationId={app.applicationId}
            name={name}
            config={config}
            onUpdateVersions={onUpdateVersions}
          />
        ))}
      </div>
    </div>
  );
}

function NamedConfigRow({ 
  applicationId, 
  name, 
  config,
  onUpdateVersions 
}: { 
  applicationId: string;
  name: string;
  config: { data: any; versions: string[] };
  onUpdateVersions: (appId: string, configName: string, versions: string[]) => Promise<void>;
}) {
  const { triggerSave, saveOnBlur, executeSave, status, error } = useAutosave(
    () => onUpdateVersions(applicationId, name, config.versions)
  );

  return (
    <div className="border-l-4 border-gray-300 pl-4">
      <div className="flex items-start gap-4">
        <Link
          to={`/applications/${applicationId}/configs/${name}`}
          className="text-blue-600 hover:underline font-medium min-w-[100px]"
        >
          {name}
        </Link>
        <div className="flex-1">
          <SemverList
            versions={config.versions}
            onChange={(versions) => {
              config.versions = versions;
              triggerSave();
            }}
            onBlur={saveOnBlur}
            onImmediateChange={(versions) => {
              config.versions = versions;
              executeSave();
            }}
          />
        </div>
        {status === 'saving' && <span className="text-sm text-gray-500">Saving...</span>}
        {status === 'saved' && <span className="text-sm text-green-600">Saved</span>}
        {status === 'error' && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}