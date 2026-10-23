import { getUsers } from "./actions";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="max-w-4xl mx-auto">
      <UserManagement initialUsers={users} />
    </div>
  );
}
