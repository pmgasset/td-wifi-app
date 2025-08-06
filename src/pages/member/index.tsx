import React from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0';

function MemberPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Member Area</h1>
      <p>Welcome! This page is only accessible to authenticated users.</p>
    </div>
  );
}

export default withPageAuthRequired(MemberPage);
