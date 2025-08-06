import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';

function MemberPage() {
  return <div>Member page</div>;
}

export default withPageAuthRequired(MemberPage);

