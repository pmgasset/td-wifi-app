import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import { withPageAuthRequired as withPageAuthRequiredServer } from '@auth0/nextjs-auth0';

function Member() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Member Area</h1>
      <p>Protected content goes here.</p>
    </main>
  );
}

export default withPageAuthRequired(Member);

export const getServerSideProps = withPageAuthRequiredServer();
