import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import MemberDashboard from '../../components/member/MemberDashboard';

function MemberPage() {
  return <MemberDashboard />;
}

export default withPageAuthRequired(MemberPage);
