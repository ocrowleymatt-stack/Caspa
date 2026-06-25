import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Shield, UserX, X } from 'lucide-react';
import {
  approveUser,
  disableUser,
  listAllUsers,
  listPendingUsers,
  promoteUser,
  rejectUser,
  type UserPublic,
} from '../api/auth';
import { useToast } from '../components/Toast';

function statusBadge(status: UserPublic['status']) {
  const styles: Record<UserPublic['status'], string> = {
    pending: 'bg-amber-500/20 text-amber-300',
    active: 'bg-emerald-500/20 text-emerald-300',
    rejected: 'bg-red-500/20 text-red-300',
    disabled: 'bg-slate-500/20 text-slate-300',
  };
  return styles[status];
}

export default function AdminUsers() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['auth', 'users', 'pending'],
    queryFn: listPendingUsers,
  });

  const { data: allUsers = [], isLoading: allLoading } = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: listAllUsers,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['auth', 'users', 'pending'] });
  };

  const approveMutation = useMutation({
    mutationFn: approveUser,
    onSuccess: () => {
      toast.success('User approved');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectUser,
    onSuccess: () => {
      toast.success('User rejected');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disableMutation = useMutation({
    mutationFn: disableUser,
    onSuccess: () => {
      toast.success('User disabled');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promoteMutation = useMutation({
    mutationFn: promoteUser,
    onSuccess: () => {
      toast.success('User promoted to admin');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-accent" /> User Management
        </h1>
        <p className="text-muted text-sm mt-1">Approve registrations and manage accounts</p>
      </div>

      <section className="card space-y-4">
        <h2 className="font-semibold">Pending approval ({pending.length})</h2>
        {pendingLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted">No pending registrations</p>
        ) : (
          <div className="space-y-2">
            {pending.map((user) => (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="text-xs text-muted mt-1">
                    Registered {new Date(user.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(user.id)}
                    className="btn-primary text-xs"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(user.id)}
                    className="btn-secondary text-xs"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">All users</h2>
        {allLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-white/10">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="py-3 pr-4">{user.displayName}</td>
                    <td className="py-3 pr-4 text-muted">{user.email}</td>
                    <td className="py-3 pr-4 capitalize">{user.role}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${statusBadge(user.status)}`}>{user.status}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.status === 'active' && user.role !== 'admin' && (
                          <>
                            <button
                              type="button"
                              disabled={disableMutation.isPending}
                              onClick={() => disableMutation.mutate(user.id)}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              <UserX className="h-3 w-3" /> Disable
                            </button>
                            <button
                              type="button"
                              disabled={promoteMutation.isPending}
                              onClick={() => promoteMutation.mutate(user.id)}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              <Shield className="h-3 w-3" /> Promote
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
