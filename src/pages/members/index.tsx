// src/pages/members/index.tsx
import React from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Layout from '../../components/Layout';

const MembersPage: React.FC = () => {
  return (
    <Layout title="Members Area">
      <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Members Area</h1>
        <p className="text-gray-700">
          This content is only available to authenticated members.
        </p>
      </div>
    </Layout>
  );
};

export default withPageAuthRequired(MembersPage);
