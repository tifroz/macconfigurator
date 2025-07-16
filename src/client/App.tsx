// 15 Lines by Claude Opus
// Main React app component with routing
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ApplicationList from './components/ApplicationList';
import ApplicationEdit from './components/ApplicationEdit';
import NamedConfigEdit from './components/NamedConfigEdit';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<ApplicationList />} />
          <Route path="/applications/new" element={<ApplicationEdit />} />
          <Route path="/applications/:applicationId" element={<ApplicationEdit />} />
          <Route path="/applications/:applicationId/configs/:configName" element={<NamedConfigEdit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;